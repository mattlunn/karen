import { Device } from '../../models';
import { ElectricVehicleCapability, NextChargeSchedule, ManualChargeSchedule } from '../../models/capabilities';
import config from '../../config/app';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { processSignal } from './signals';
import { ensureHistoricalMonthly, storeMonthlyAggregates } from './mileage';
import { pickNextChargeSchedule, buildScheduleNotification } from './schedule';
import { planDeadlineCharge, planOpportunisticCharge, isWithinBlocks, Block } from './price-plan';
import { toPriceSlots, medianPence } from '../../helpers/prices';
import dayjs, { Dayjs } from '../../dayjs';
import logger from '../../logger';
import nowAndSetIntervalForTime from '../../helpers/now-and-set-interval-for-time';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';

// Persisted on device.meta.chargeSchedule. The three public fields feed the
// existing UI (via getNextChargeSchedule); windowEnd / chargeBlocks are the
// committed deadline-charge plan the scheduler reads back each tick.
interface StoredChargeSchedule extends NextChargeSchedule {
  windowEnd?: string;
  chargeBlocks?: { start: string; end: string }[];
}

const TRANSITION_GRACE_MINUTES = 10;

// The charge blocks the scheduler is currently driving - deadline windows or
// BAU opportunistic blocks. Transient module state (single vehicle), read back
// via the ElectricVehicle capability so the energy-insights graph can shade the
// planned run windows.
let currentPlannedBlocks: Block[] = [];

export async function synchronize() {
  let device = await Device.findByProviderId('vehicle', config.smartcar.vehicle_id);

  try {
    const signals = await client.getSignals();
    const { make, model, year } = signals.included.vehicle.attributes;

    if (!device) {
      device = Device.build({
        provider: 'vehicle',
        providerId: config.smartcar.vehicle_id,
        name: `${make} ${model}`,
      });
    }

    device.manufacturer = make;
    device.model = `${model} (${year})`;

    await device.save();

    const ev = device.getElectricVehicleCapability();

    for (const signal of signals.data) {
      try {
        await processSignal(device, signal.attributes);
      } catch (error) {
        logger.error(error, `Error processing signal ${signal.attributes.code}`);
      }
    }

    // We can't get the charge limit from SmartCar, so just one time force to 100
    // so we are in-sync with what's set.
    if (await ev.getChargeLimitEvent() === null) {
      await client.setChargeLimit(100);
    }

    await device.getConnectivityCapability().setIsConnectedState(true);
  } catch (e) {
    if (device) {
      await device.getConnectivityCapability().setIsConnectedState(false);
    }
    throw e;
  }
}

Device.registerProvider('vehicle', {
  getCapabilities() {
    return ['ELECTRIC_VEHICLE', 'ENERGY_MONITOR', 'CONNECTIVITY'];
  },

  provideElectricVehicleCapability() {
    return {
      async setChargeLimit(device: Device, value: number) {
        await client.setChargeLimit(value);
        await device.getElectricVehicleCapability().setChargeLimitState(value);
      },

      async setIsCharging(_device: Device, value: boolean) {
        if (value) {
          await client.startCharge();
        } else {
          await client.stopCharge();
        }
      },

      getNextChargeSchedule(device: Device): NextChargeSchedule | null {
        const stored = device.meta.chargeSchedule as StoredChargeSchedule | undefined;

        if (stored) {
          return {
            targetPercentage: stored.targetPercentage,
            targetTime: stored.targetTime,
            calculatedStartTime: stored.calculatedStartTime,
          };
        }

        const next = pickNextChargeSchedule(config.smartcar.charge_schedules ?? [], dayjs());

        if (!next) {
          return null;
        }

        return {
          targetPercentage: next.targetPercentage,
          targetTime: next.targetTime.toISOString(),
          calculatedStartTime: null,
        };
      },

      async setManualChargeSchedule(device: Device, schedule: ManualChargeSchedule | null) {
        device.meta.chargeSchedule = schedule ? {
          targetPercentage: schedule.targetPercentage,
          targetTime: schedule.targetTime,
          calculatedStartTime: null,
        } satisfies NextChargeSchedule : undefined;

        await device.save();
      },

      getPlannedChargeBlocks(): { start: string; end: string }[] {
        return currentPlannedBlocks.map(b => ({ start: b.start.toISOString(), end: b.end.toISOString() }));
      },
    };
  },

  synchronize,
});

async function clearNextChargeIfExpired(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const stored = device.meta.chargeSchedule as NextChargeSchedule | undefined;

  if (!stored || !now.isAfter(dayjs(stored.targetTime))) {
    return;
  }

  logger.info('Charge schedule target time passed, resetting charge limit');

  device.meta.chargeSchedule = undefined;

  await ev.setChargeLimit(config.smartcar.default_charge_limit);
  await device.save();
}

async function chooseNextCharge(device: Device, now: Dayjs) {
  if (device.meta.chargeSchedule) {
    return;
  }

  const next = pickNextChargeSchedule(config.smartcar.charge_schedules ?? [], now);

  if (!next) {
    return;
  }

  device.meta.chargeSchedule = {
    targetPercentage: next.targetPercentage,
    targetTime: next.targetTime.toISOString(),
    calculatedStartTime: null,
  } satisfies NextChargeSchedule;
}

// Gated on the live charge limit so the SmartCar API and the notification
// fire exactly once per occurrence — re-firing only happens if the limit
// is reset (e.g. the next occurrence rolls in).
async function startChargingAndNotifyUsers(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const stored = device.meta.chargeSchedule as NextChargeSchedule | undefined;

  if (!stored || !stored.calculatedStartTime) {
    return;
  }

  const startTime = dayjs(stored.calculatedStartTime);

  if (!now.isSameOrAfter(startTime)) {
    return;
  }

  if (await ev.getChargeLimit() === stored.targetPercentage) {
    return;
  }

  const targetTime = dayjs(stored.targetTime);

  logger.info(`Starting charge to reach ${stored.targetPercentage}% by ${targetTime.format('HH:mm')}`);

  await ev.setChargeLimit(stored.targetPercentage);

  const isCableConnected = await ev.getIsCableConnected();

  if (isCableConnected) {
    await ev.setIsCharging(true);

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: buildScheduleNotification(stored.targetPercentage, startTime, targetTime, true),
    });
  } else {
    logger.warn('Charge schedule: cable not connected, cannot start charging');

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: buildScheduleNotification(stored.targetPercentage, startTime, targetTime, false),
    });
  }
}

// ---------------------------------------------------------------------------
// Price-aware charging
// ---------------------------------------------------------------------------

// Verification state for the last commanded start/stop transition.
let commandedCharging: boolean | null = null;
let commandedAt: Dayjs | null = null;
let transitionRetried = false;
let transitionIssueNotified = false;

async function getEnergyCostCapability() {
  const devices = await Device.findByCapability('ENERGY_COST');

  return devices.length === 0 ? null : devices[0].getEnergyCostCapability();
}

async function getForwardPriceSlots(now: Date, hours: number) {
  const energyCost = await getEnergyCostCapability();

  if (energyCost === null) {
    return [];
  }

  const until = dayjs(now).add(hours, 'hour').toDate();
  const events = await energyCost.getUnitRateHistory({ since: now, until });

  return toPriceSlots(events, now, until);
}

async function getBaselinePence(now: Date): Promise<number | null> {
  const energyCost = await getEnergyCostCapability();

  if (energyCost === null) {
    return null;
  }

  const since = dayjs(now).subtract(config.smartcar.price_aware_charging.baseline_days, 'day').toDate();
  const events = await energyCost.getUnitRateHistory({ since, until: now });

  return medianPence(toPriceSlots(events, since, now));
}

async function getCurrentRatePence(): Promise<number | null> {
  const energyCost = await getEnergyCostCapability();
  const event = energyCost === null ? null : await energyCost.getUnitRateEvent();

  return event?.value ?? null;
}

function computeHoursNeeded(percentageNeeded: number): number {
  const chargeRatePercentPerHour = (config.smartcar.charge_power_watts / 1000) / config.smartcar.battery_capacity_kwh * 100;

  return Math.max(0, percentageNeeded) / chargeRatePercentPerHour;
}

// Applies the desired charging state for `now` and verifies it took effect.
// startCharge / stopCharge are only observable via the charge-ischarging
// webhook, so each transition is commanded once, retried once after a grace
// period, then escalated to an admin alert.
async function applyChargeBlocks(ev: ElectricVehicleCapability, now: Dayjs, blocks: Block[]) {
  const desired = isWithinBlocks(blocks, now.toDate());
  const actual = await ev.getIsCharging();

  if (desired === actual) {
    commandedCharging = null;
    commandedAt = null;
    transitionRetried = false;
    transitionIssueNotified = false;
    return;
  }

  if (commandedCharging !== desired) {
    logger.info(`Price-aware charging: commanding isCharging=${desired}`);

    await ev.setIsCharging(desired);
    commandedCharging = desired;
    commandedAt = now;
    transitionRetried = false;
    transitionIssueNotified = false;
    return;
  }

  if (commandedAt === null || now.diff(commandedAt, 'minute') < TRANSITION_GRACE_MINUTES) {
    return;
  }

  if (!transitionRetried) {
    logger.warn(`Price-aware charging: isCharging=${actual} still disagrees with commanded ${desired}; retrying`);

    await ev.setIsCharging(desired);
    transitionRetried = true;
    commandedAt = now;
    return;
  }

  if (!transitionIssueNotified) {
    transitionIssueNotified = true;

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `Car charging did not ${desired ? 'start' : 'stop'} as commanded. Check the cable is fully plugged in and the Kia app.`,
      priority: 1,
    });
  }
}

async function planDeadlineWindowIfNeeded(device: Device, now: Dayjs, hoursNeeded: number, deadline: Dayjs) {
  const stored = device.meta.chargeSchedule as StoredChargeSchedule;

  if (stored.windowEnd && now.isBefore(dayjs(stored.windowEnd))) {
    return;
  }

  const horizon = config.smartcar.price_aware_charging.planning_horizon_hours;
  const minBlock = config.smartcar.price_aware_charging.min_charge_block_minutes;
  const slots = await getForwardPriceSlots(now.toDate(), horizon);

  let windowEnd: Date;
  let blocks: Block[];

  if (slots.length === 0) {
    // No forward prices: a deadline must never be missed, so charge
    // continuously from `deadline - hoursNeeded`.
    windowEnd = deadline.toDate();
    blocks = [{ start: deadline.subtract(hoursNeeded, 'hour').toDate(), end: deadline.toDate() }];
  } else {
    const plan = planDeadlineCharge(slots, hoursNeeded, now.toDate(), deadline.toDate(), minBlock);

    windowEnd = plan.windowEnd;
    blocks = plan.blocks;
  }

  device.meta.chargeSchedule = {
    ...stored,
    windowEnd: windowEnd.toISOString(),
    chargeBlocks: blocks.map(b => ({ start: b.start.toISOString(), end: b.end.toISOString() })),
    calculatedStartTime: blocks[0]?.start.toISOString() ?? null,
  } satisfies StoredChargeSchedule;

  await device.save();
}

// `hoursNeeded` here already includes charge_start_buffer_hours.
async function runDeadlineMode(device: Device, ev: ElectricVehicleCapability, now: Dayjs, stored: StoredChargeSchedule, hoursNeeded: number) {
  const deadline = dayjs(stored.targetTime);

  await planDeadlineWindowIfNeeded(device, now, hoursNeeded, deadline);

  const refreshed = device.meta.chargeSchedule as StoredChargeSchedule;
  let blocks: Block[] = (refreshed.chargeBlocks ?? []).map(b => ({ start: new Date(b.start), end: new Date(b.end) }));

  // The deadline always beats cost - checked every tick, so a window committed
  // while there was slack is still overridden if charging underdelivers.
  if (deadline.diff(now, 'hour', true) <= hoursNeeded) {
    blocks = [{ start: now.toDate(), end: deadline.toDate() }];

    if (await ev.getChargeLimit() !== stored.targetPercentage) {
      await ev.setChargeLimit(stored.targetPercentage);
    }
  }

  currentPlannedBlocks = blocks;

  await startChargingAndNotifyUsers(device, ev, now);
  await applyChargeBlocks(ev, now, blocks);
}

async function runBauMode(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const [isCableConnected, chargePercentage, chargeLimitEvent] = await Promise.all([
    ev.getIsCableConnected(),
    ev.getChargePercentage(),
    ev.getChargeLimitEvent(),
  ]);

  const defaultLimit = config.smartcar.default_charge_limit;

  if (!isCableConnected || chargePercentage >= defaultLimit) {
    currentPlannedBlocks = [];
    await applyChargeBlocks(ev, now, []);
    return;
  }

  if ((chargeLimitEvent?.value ?? null) !== defaultLimit) {
    await ev.setChargeLimit(defaultLimit);
  }

  const baseline = await getBaselinePence(now.toDate());

  if (baseline === null) {
    // No price history at all: charge whenever it's plugged in.
    const fallback: Block[] = [{ start: now.toDate(), end: now.add(1, 'day').toDate() }];

    currentPlannedBlocks = fallback;
    await applyChargeBlocks(ev, now, fallback);
    return;
  }

  const horizon = config.smartcar.price_aware_charging.planning_horizon_hours;
  const minBlock = config.smartcar.price_aware_charging.min_charge_block_minutes;
  const slots = await getForwardPriceSlots(now.toDate(), horizon);

  let blocks: Block[];

  if (slots.length === 0) {
    // No forward prices: decide slot by slot off the current rate.
    const rate = await getCurrentRatePence();

    blocks = rate !== null && rate < baseline
      ? [{ start: now.toDate(), end: now.add(30, 'minute').toDate() }]
      : [];
  } else {
    blocks = planOpportunisticCharge(slots, now.toDate(), baseline, minBlock);
  }

  currentPlannedBlocks = blocks;
  await applyChargeBlocks(ev, now, blocks);
}

// BAU is the default. A recurring charge schedule is nearly always set (just
// weeks away), so deadline mode only takes over once the deadline is close
// enough that BAU alone wouldn't reach the target in time - within the time
// still needed to charge (from live SoC, plus the start buffer) plus one full
// planning horizon of lead time for the window planner to place cheap slots.
async function runPriceAwareCharging(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const stored = device.meta.chargeSchedule as StoredChargeSchedule | undefined;

  if (stored) {
    const bufferHours = config.smartcar.charge_start_buffer_hours ?? 0;
    const hoursNeeded = computeHoursNeeded(stored.targetPercentage - await ev.getChargePercentage()) + bufferHours;
    const engageWithinHours = hoursNeeded + config.smartcar.price_aware_charging.planning_horizon_hours;

    if (dayjs(stored.targetTime).diff(now, 'hour', true) <= engageWithinHours) {
      await runDeadlineMode(device, ev, now, stored, hoursNeeded);
      return;
    }

    // Deadline still far off: drop any committed window so deadline mode
    // re-plans fresh when it re-engages, then let BAU top the battery up.
    if (stored.windowEnd !== undefined || stored.chargeBlocks !== undefined) {
      device.meta.chargeSchedule = {
        targetPercentage: stored.targetPercentage,
        targetTime: stored.targetTime,
        calculatedStartTime: null,
      } satisfies StoredChargeSchedule;

      await device.save();
    }
  }

  await runBauMode(device, ev, now);
}

// Run the charge schedule check every 5 minutes so block boundaries are hit
// within a few minutes of the half-hour.
nowAndSetInterval(createBackgroundTransaction('vehicle:charge-schedule', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const ev = device.getElectricVehicleCapability();
  const now = dayjs();

  await clearNextChargeIfExpired(device, ev, now);
  await chooseNextCharge(device, now);
  await runPriceAwareCharging(device, ev, now);
}), 5 * 60 * 1000);

nowAndSetIntervalForTime(createBackgroundTransaction('vehicle:monthly-mileage', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const capability = device.getElectricVehicleCapability();
  const startOfMonth = dayjs().startOf('month').toDate();
  const now = new Date();

  await ensureHistoricalMonthly(device, capability);
  await storeMonthlyAggregates(capability, startOfMonth, now, now);
}), '00:00');
