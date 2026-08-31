import { Device } from '../../models';
import { ElectricVehicleCapability, ChargeSchedule } from '../../models/capabilities';
import config from '../../config/app';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { processSignal } from './signals';
import { ensureHistoricalMonthly, storeMonthlyAggregates } from './mileage';
import { pickNextChargeSchedule, buildChargingFailureNotification } from './schedule';
import { planDeadlineCharge, planOpportunisticCharge, isWithinBlocks, Block } from './price-plan';
import { toPriceSlots, medianPence } from '../../helpers/prices';
import dayjs, { Dayjs } from '../../dayjs';
import logger from '../../logger';
import nowAndSetIntervalForTime from '../../helpers/now-and-set-interval-for-time';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';

// The committed deadline-charge plan, persisted on device.meta.chargeWindow
// (separately from device.meta.chargeSchedule, which is just the target). Read
// back each tick and not re-planned until `now` passes windowEnd.
interface ChargeWindow {
  windowEnd: string;
  chargeBlocks: { start: string; end: string }[];
}

function getChargeWindow(device: Device): ChargeWindow | undefined {
  return device.meta.chargeWindow as ChargeWindow | undefined;
}

// A deadline block is active and we've commanded charging, but the car still
// isn't charging after this long - raise one alert (cable / car-asleep).
const NOT_CHARGING_ALERT_MINUTES = 15;

// Transient (single-vehicle) module state; surfaced via the ElectricVehicle
// capability's getPlannedChargeBlocks().
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

    // The scheduler owns start/stop; the car's own limit is pinned at 100 so a
    // start command always takes effect (and if Karen is down it charges to
    // full rather than being stuck at a stale lower limit).
    if ((await ev.getChargeLimitEvent())?.value !== 100) {
      await ev.setChargeLimit(100);
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

      getNextChargeSchedule(device: Device): ChargeSchedule | null {
        const stored = device.meta.chargeSchedule as ChargeSchedule | undefined;

        if (stored) {
          return stored;
        }

        const next = pickNextChargeSchedule(config.smartcar.charge_schedules ?? [], dayjs());

        if (!next) {
          return null;
        }

        return { targetPercentage: next.targetPercentage, targetTime: next.targetTime.toISOString() };
      },

      async setManualChargeSchedule(device: Device, schedule: ChargeSchedule | null) {
        device.meta.chargeSchedule = schedule ? {
          targetPercentage: schedule.targetPercentage,
          targetTime: schedule.targetTime,
        } satisfies ChargeSchedule : undefined;
        device.meta.chargeWindow = undefined;

        await device.save();
      },

      getPlannedChargeBlocks(): { start: string; end: string }[] {
        return currentPlannedBlocks.map(b => ({ start: b.start.toISOString(), end: b.end.toISOString() }));
      },
    };
  },

  synchronize,
});

async function clearNextChargeIfExpired(device: Device, now: Dayjs) {
  const stored = device.meta.chargeSchedule as ChargeSchedule | undefined;

  if (!stored || !now.isAfter(dayjs(stored.targetTime))) {
    return;
  }

  logger.info('Charge schedule target time passed');

  device.meta.chargeSchedule = undefined;
  device.meta.chargeWindow = undefined;

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
  } satisfies ChargeSchedule;
}

// ---------------------------------------------------------------------------
// Price-aware charging
// ---------------------------------------------------------------------------

// A deadline block wants charging but the car isn't - since when, and have we
// alerted for it. Reset once it charges (or leaves the block).
let deadlineNotChargingSince: Dayjs | null = null;
let deadlineAlertSent = false;

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

  const since = dayjs(now).subtract(config.smartcar.charge_median_rate_days, 'day').toDate();
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

// charge_plan_mode=readonly: a non-prod instance against the shared physical car
// still plans and populates the UI / insights, it just doesn't command the car.
function isReadOnly(): boolean {
  return config.smartcar.charge_plan_mode === 'readonly';
}

// The scheduler owns start/stop; the car's own limit is pinned at 100 (see
// synchronize), so a start command always takes effect and this is just:
// charge while inside a block and below target, otherwise stop. Re-issued each
// tick until the charge-ischarging webhook confirms it stuck. `deadline` is
// passed only in deadline mode, to alert if a due charge never actually starts.
async function applyChargeBlocks(ev: ElectricVehicleCapability, now: Dayjs, blocks: Block[], targetPercentage: number, deadline?: Dayjs) {
  const [chargePercentage, isCharging] = await Promise.all([ev.getChargePercentage(), ev.getIsCharging()]);
  const desired = isWithinBlocks(blocks, now.toDate()) && chargePercentage < targetPercentage;

  if (isReadOnly()) {
    logger.info(`Price-aware charging: [readonly] would set isCharging=${desired}`);
    return;
  }

  if (desired !== isCharging) {
    logger.info(`Price-aware charging: setting isCharging=${desired}`);
    await ev.setIsCharging(desired);
  }

  if (deadline === undefined || !(desired && !isCharging)) {
    deadlineNotChargingSince = null;
    deadlineAlertSent = false;
    return;
  }

  deadlineNotChargingSince ??= now;

  if (!deadlineAlertSent && now.diff(deadlineNotChargingSince, 'minute') >= NOT_CHARGING_ALERT_MINUTES) {
    deadlineAlertSent = true;

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: buildChargingFailureNotification(targetPercentage, deadline),
      priority: 1,
    });
  }
}

async function planDeadlineWindowIfNeeded(device: Device, now: Dayjs, hoursNeeded: number, deadline: Dayjs) {
  const existing = getChargeWindow(device);

  if (existing && now.isBefore(dayjs(existing.windowEnd))) {
    return;
  }

  const horizon = config.smartcar.charge_planning_horizon_hours;
  const minBlock = config.smartcar.charge_min_block_minutes;
  const slots = await getForwardPriceSlots(now.toDate(), horizon);

  // With no forward prices this yields an empty plan; nothing charges until they
  // arrive, and the deadline-beats-cost check in runDeadlineMode is the backstop
  // if the deadline gets close first.
  const plan = planDeadlineCharge(slots, hoursNeeded, now.toDate(), deadline.toDate(), minBlock);

  device.meta.chargeWindow = {
    windowEnd: plan.windowEnd.toISOString(),
    chargeBlocks: plan.blocks.map(b => ({ start: b.start.toISOString(), end: b.end.toISOString() })),
  } satisfies ChargeWindow;

  await device.save();
}

// `hoursNeeded` here already includes charge_start_buffer_hours.
async function runDeadlineMode(device: Device, ev: ElectricVehicleCapability, now: Dayjs, stored: ChargeSchedule, hoursNeeded: number) {
  const deadline = dayjs(stored.targetTime);

  await planDeadlineWindowIfNeeded(device, now, hoursNeeded, deadline);

  let blocks: Block[] = (getChargeWindow(device)?.chargeBlocks ?? []).map(b => ({ start: new Date(b.start), end: new Date(b.end) }));

  // The deadline always beats cost - checked every tick, so a window committed
  // while there was slack is still overridden if charging underdelivers.
  if (deadline.diff(now, 'hour', true) <= hoursNeeded) {
    blocks = [{ start: now.toDate(), end: deadline.toDate() }];
  }

  currentPlannedBlocks = blocks;

  await applyChargeBlocks(ev, now, blocks, stored.targetPercentage, deadline);
}

async function runBauMode(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const [isCableConnected, chargePercentage] = await Promise.all([
    ev.getIsCableConnected(),
    ev.getChargePercentage(),
  ]);

  const defaultLimit = config.smartcar.default_charge_limit;

  if (!isCableConnected || chargePercentage >= defaultLimit) {
    currentPlannedBlocks = [];
    await applyChargeBlocks(ev, now, [], defaultLimit);
    return;
  }

  const baseline = await getBaselinePence(now.toDate());

  if (baseline === null) {
    // No rate history to judge "cheap" against - stay off.
    currentPlannedBlocks = [];
    await applyChargeBlocks(ev, now, [], defaultLimit);
    return;
  }

  const horizon = config.smartcar.charge_planning_horizon_hours;
  const minBlock = config.smartcar.charge_min_block_minutes;
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
  await applyChargeBlocks(ev, now, blocks, defaultLimit);
}

// BAU is the default. A recurring charge schedule is nearly always set (just
// weeks away), so deadline mode only takes over once charging would need to
// occupy `charge_deadline_engage_fraction` of the time still left before the
// deadline - `(hours to charge from live SoC + start buffer) / hours to
// deadline`. That scales with how much charge is actually needed: an 80%->100%
// top-up engages far later than a 15%->100% charge with the same deadline.
async function runPriceAwareCharging(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const stored = device.meta.chargeSchedule as ChargeSchedule | undefined;

  if (stored) {
    const bufferHours = config.smartcar.charge_start_buffer_hours ?? 0;
    const hoursNeeded = computeHoursNeeded(stored.targetPercentage - await ev.getChargePercentage()) + bufferHours;
    const hoursToDeadline = dayjs(stored.targetTime).diff(now, 'hour', true);

    if (hoursNeeded / hoursToDeadline >= config.smartcar.charge_deadline_engage_fraction) {
      await runDeadlineMode(device, ev, now, stored, hoursNeeded);
      return;
    }

    // Deadline still far off: discard any committed window so deadline mode
    // re-plans fresh when it re-engages, then let BAU top the battery up.
    if (getChargeWindow(device) !== undefined) {
      device.meta.chargeWindow = undefined;
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

  await clearNextChargeIfExpired(device, now);
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
