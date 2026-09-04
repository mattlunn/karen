import { Device } from '../../models';
import { ElectricVehicleCapability, ChargeSchedule } from '../../models/capabilities';
import config from '../../config/app';
import nowAndSetCron from '../../helpers/now-and-set-cron';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { processSignal } from './signals';
import { ensureHistoricalMonthly, storeMonthlyAggregates } from './mileage';
import { pickNextChargeSchedule, buildChargingFailureNotification } from './schedule';
import { planCharge, isDeadlineEngaged, isWithinSlots, ChargePlan } from './price-plan';
import { toPriceSlots, medianPence, groupIntoBlocks, startOfSlot, PriceSlot } from '../../helpers/prices';
import dayjs, { Dayjs } from '../../dayjs';
import logger from '../../logger';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';

// The current plan, persisted on device.meta.chargePlan (separately from
// device.meta.chargeSchedule, which is just the target). It is fixed for a
// publication, so it has to survive a restart rather than be rebuilt from prices
// that have since moved.
interface StoredChargePlan {
  end: string;
  slots: { start: string; end: string }[];
  target: number;
  deadline: string | null;
}

function getPlan(device: Device): ChargePlan | null {
  const stored = device.meta.chargePlan as StoredChargePlan | undefined;

  return stored === undefined ? null : {
    end: new Date(stored.end),
    slots: stored.slots.map(s => ({ start: new Date(s.start), end: new Date(s.end) })),
    target: stored.target,
    deadline: stored.deadline === null ? null : new Date(stored.deadline),
  };
}

async function clearPlan(device: Device): Promise<void> {
  if (device.meta.chargePlan !== undefined) {
    device.meta.chargePlan = undefined;

    await device.save();
  }
}

// A deadline plan is active and we've commanded charging, but the car still
// isn't charging after this long - raise one alert (cable / car-asleep).
const NOT_CHARGING_ALERT_MINUTES = 15;

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
        device.meta.chargePlan = undefined;

        await device.save();
      },

      getPlannedChargeBlocks(device: Device): { start: string; end: string }[] {
        const plan = getPlan(device);

        if (plan === null) {
          return [];
        }

        // Coalesced purely for display - the plan itself is half-hour slots.
        return groupIntoBlocks(plan.slots, 0).map(b => ({
          start: b.start.toISOString(),
          end: b.end.toISOString(),
        }));
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
  device.meta.chargePlan = undefined;

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

// Octopus fetches 48h of forward rates, so this bounds the query rather than the
// plan - on Agile the published prices always run out first.
const FORWARD_WINDOW_HOURS = 48;

async function getForwardPriceSlots(now: Date) {
  const energyCost = await getEnergyCostCapability();

  if (energyCost === null) {
    return [];
  }

  // Aligned to the slot boundary rather than `now`, so plugging in mid-slot can
  // still take the rest of the slot it lands in: `toPriceSlots` drops a partial
  // at the edge, and that slot is often the cheapest of the day.
  const since = startOfSlot(now);
  const until = dayjs(now).add(FORWARD_WINDOW_HOURS, 'hour').toDate();
  const events = await energyCost.getUnitRateHistory({ since, until });

  return toPriceSlots(events, since, until);
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

function chargeRatePercentPerHour(): number {
  return (config.smartcar.charge_power_watts / 1000) / config.smartcar.battery_capacity_kwh * 100;
}

function getSchedule(device: Device): { targetPercentage: number; targetTime: Date } | null {
  const stored = device.meta.chargeSchedule as ChargeSchedule | undefined;

  return stored === undefined ? null : {
    targetPercentage: stored.targetPercentage,
    targetTime: new Date(stored.targetTime),
  };
}

// charge_plan_mode=readonly: a non-prod instance against the shared physical car
// still plans and populates the UI / insights, it just doesn't command the car.
function isReadOnly(): boolean {
  return config.smartcar.charge_plan_mode === 'readonly';
}

// The scheduler owns start/stop; the car's own limit is pinned at 100 (see
// synchronize), so a start command always takes effect and this is just:
// charge while inside a planned slot and below target, otherwise stop. Re-issued
// each tick until the charge-ischarging webhook confirms it stuck.
async function applyPlan(ev: ElectricVehicleCapability, now: Dayjs, plan: ChargePlan | null, chargePercentage: number) {
  const isCharging = await ev.getIsCharging();
  const desired = plan !== null && isWithinSlots(plan.slots, now.toDate()) && chargePercentage < plan.target;

  if (isReadOnly()) {
    logger.info(`Price-aware charging: [readonly] would set isCharging=${desired}`);
    return;
  }

  if (desired !== isCharging) {
    logger.info(`Price-aware charging: setting isCharging=${desired}`);
    await ev.setIsCharging(desired);
  }

  // Only a deadline plan alerts: a charge that's merely opportunistic failing to
  // start isn't worth waking anybody for.
  if (plan === null || plan.deadline === null || !(desired && !isCharging)) {
    deadlineNotChargingSince = null;
    deadlineAlertSent = false;
    return;
  }

  deadlineNotChargingSince ??= now;

  if (!deadlineAlertSent && now.diff(deadlineNotChargingSince, 'minute') >= NOT_CHARGING_ALERT_MINUTES) {
    deadlineAlertSent = true;

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: buildChargingFailureNotification(plan.target, dayjs(plan.deadline)),
      priority: 1,
    });
  }
}

async function createPlan(device: Device, slots: PriceSlot[], now: Dayjs, chargePercentage: number): Promise<ChargePlan> {
  const baselinePence = await getBaselinePence(now.toDate());

  // With no forward prices this yields an empty plan and nothing charges until
  // they arrive, pending the admin acting on the Octopus alert.
  const plan = planCharge({
    slots,
    now: now.toDate(),
    chargePercentage,
    baselinePence,
    schedule: getSchedule(device),
    chargeRatePercentPerHour: chargeRatePercentPerHour(),
    defaultLimit: config.smartcar.default_charge_limit,
    plungeLimit: config.smartcar.charge_plunge_limit,
    deadlineEngageFraction: config.smartcar.charge_deadline_engage_fraction,
    startBufferHours: config.smartcar.charge_start_buffer_hours,
  });

  device.meta.chargePlan = {
    end: plan.end.toISOString(),
    slots: plan.slots.map(s => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
    target: plan.target,
    deadline: plan.deadline === null ? null : plan.deadline.toISOString(),
  } satisfies StoredChargePlan;

  await device.save();

  logger.info(`Price-aware charging: planned ${plan.slots.length} slot(s) to ${plan.target}%${plan.deadline === null ? '' : ` for ${plan.deadline.toISOString()}`}`);

  return plan;
}

// A plan is fixed so it can't jitter as prices are restated, with two exceptions.
//
// Prices reaching past where the plan ends are strictly more information than it
// was built from. Agile publishes early afternoon for a plan running to midnight,
// so holding the old one spends the evening on slots the new day beats outright.
//
// And a plan made while a deadline was still far off must not sit frozen while
// that deadline creeps into engagement range, or it is missed outright. A
// publication reaches further than a typical deadline lead time, so this is the
// common case rather than an edge one.
function needsReplan(device: Device, plan: ChargePlan, slots: PriceSlot[], now: Dayjs, chargePercentage: number): boolean {
  if (!now.isBefore(plan.end)) {
    return true;
  }

  const publishedEnd = slots.at(-1)?.end;

  if (publishedEnd !== undefined && publishedEnd > plan.end) {
    return true;
  }

  const schedule = getSchedule(device);

  if (plan.deadline !== null || schedule === null) {
    return false;
  }

  return isDeadlineEngaged({
    schedule,
    now: now.toDate(),
    chargePercentage,
    chargeRatePercentPerHour: chargeRatePercentPerHour(),
    deadlineEngageFraction: config.smartcar.charge_deadline_engage_fraction,
    startBufferHours: config.smartcar.charge_start_buffer_hours,
  });
}

async function runPriceAwareCharging(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const [isCableConnected, chargePercentage] = await Promise.all([
    ev.getIsCableConnected(),
    ev.getChargePercentage(),
  ]);

  // Nothing can charge, and the plan is stale the moment the car leaves - it is
  // rebuilt from live SoC when the cable goes back in.
  if (!isCableConnected) {
    await clearPlan(device);
    await applyPlan(ev, now, null, chargePercentage);
    return;
  }

  const slots = await getForwardPriceSlots(now.toDate());
  let plan = getPlan(device);

  if (plan === null || needsReplan(device, plan, slots, now, chargePercentage)) {
    plan = await createPlan(device, slots, now, chargePercentage);
  }

  await applyPlan(ev, now, plan, chargePercentage);
}

// Aligned ticks hit the half-hour slot boundaries exactly, so the 5-minute cadence
// is for what isn't aligned: reacting to the cable being plugged in, and stopping
// within five minutes of the charge limit rather than thirty.
nowAndSetCron(createBackgroundTransaction('vehicle:charge-schedule', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const ev = device.getElectricVehicleCapability();
  const now = dayjs();

  await clearNextChargeIfExpired(device, now);
  await chooseNextCharge(device, now);
  await runPriceAwareCharging(device, ev, now);
}), '*/5 * * * *');

nowAndSetCron(createBackgroundTransaction('vehicle:monthly-mileage', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const capability = device.getElectricVehicleCapability();
  const startOfMonth = dayjs().startOf('month').toDate();
  const now = new Date();

  await ensureHistoricalMonthly(device, capability);
  await storeMonthlyAggregates(capability, startOfMonth, now, now);
}), '0 0 * * *');
