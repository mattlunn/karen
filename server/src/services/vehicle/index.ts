import { Device } from '../../models';
import { ElectricVehicleCapability, ScheduleChargeRequest, ScheduledCharge, ChargeType } from '../../models/capabilities';
import config from '../../config';
import nowAndSetCron from '../../helpers/now-and-set-cron';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { processVehicle, isAtHome } from './vehicle-state';
import type { BridgeCommandResponse, BridgeVehicle } from './types';
import { ensureHistoricalMonthly, storeMonthlyAggregates } from './mileage';
import { pickNextChargeSchedule, buildChargingFailureNotification } from './schedule';
import { planCharge, isDeadlineEngaged, deadlineEngagesAt, isWithinSlots, ChargePlan } from './price-plan';
import { toPriceSlots, groupIntoBlocks, PriceSlot } from '../../helpers/prices';
import dayjs, { Dayjs } from '../../dayjs';
import logger from '../../logger';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';

// The current plan, persisted on device.meta.chargePlan (separately from
// device.meta.chargeSchedule, which is just the target). It is fixed for a
// publication, so it has to survive a restart rather than be rebuilt from prices
// that have since moved.
interface StoredChargePlan {
  end: string;
  publishedEnd: string;
  slots: { start: string; end: string; isEstimated: boolean }[];
  target: number;
  deadline: string | null;
}

function getPlan(device: Device): ChargePlan | null {
  const stored = device.meta.chargePlan as StoredChargePlan | undefined;

  return stored === undefined ? null : {
    end: new Date(stored.end),
    publishedEnd: new Date(stored.publishedEnd),
    slots: stored.slots.map(s => ({ start: new Date(s.start), end: new Date(s.end), isEstimated: s.isEstimated })),
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

function resolveNextChargeSchedule(device: Device): ScheduleChargeRequest | null {
  const stored = device.meta.chargeSchedule as ScheduleChargeRequest | undefined;

  if (stored) {
    return stored;
  }

  const next = pickNextChargeSchedule(config.vehicle.charge_schedules ?? [], dayjs());

  return next ? { targetPercentage: next.targetPercentage, targetTime: next.targetTime.toISOString() } : null;
}

// A deadline plan is active and we've commanded charging, but the car still
// isn't charging after this long - raise one alert (cable / car-asleep).
const NOT_CHARGING_ALERT_MINUTES = 15;

// Karen supports a single car, so the device is found by provider rather than
// by Kia's vehicle id, which synchronize keeps up to date.
async function findVehicleDevice(): Promise<Device | undefined> {
  const [device] = await Device.findByProvider('vehicle');

  return device;
}

async function findVehicleDeviceOrError(): Promise<Device> {
  const device = await findVehicleDevice();

  if (device === undefined) {
    throw new Error('No vehicle device found');
  }

  return device;
}

async function refreshFromBridge(): Promise<{ device: Device; vehicle: BridgeVehicle }> {
  let device = await findVehicleDevice();

  try {
    const vehicles = await client.listVehicles();

    if (vehicles.length !== 1) {
      throw new Error(`Expected exactly one vehicle from kia-connect-bridge, got ${vehicles.length}`);
    }

    const [vehicle] = vehicles;

    device ??= Device.build({
      provider: 'vehicle',
      providerId: vehicle.id,
      name: vehicle.name ?? 'Car',
    });

    device.providerId = vehicle.id;

    if (vehicle.model !== null) {
      device.model = vehicle.model;
    }

    await device.save();
    await processVehicle(device, vehicle);
    await device.getConnectivityCapability().setIsConnectedState(true);

    return { device, vehicle };
  } catch (e) {
    if (device) {
      await device.getConnectivityCapability().setIsConnectedState(false);
    }
    throw e;
  }
}

export async function synchronize() {
  const { device, vehicle } = await refreshFromBridge();

  // The scheduler owns start/stop; the car's own limit is pinned at 100 so a
  // start command always takes effect (and if Karen is down it charges to
  // full rather than being stuck at a stale lower limit).
  if (!isReadOnly() && vehicle.ev_charge_limits_ac !== null && vehicle.ev_charge_limits_ac !== 100) {
    await device.getElectricVehicleCapability().setChargeLimit(100);
  }
}

// Kia's own action status is usually UNKNOWN even when the command worked, so
// the refreshed vehicle is what says whether it took effect.
async function processCommandResponse(device: Device, response: BridgeCommandResponse): Promise<void> {
  logger.info(`kia-connect-bridge: action ${response.action_id} finished with status ${response.action_status}`);

  await processVehicle(device, response.vehicle);
}

Device.registerProvider('vehicle', {
  getCapabilities() {
    return ['ELECTRIC_VEHICLE', 'ENERGY_MONITOR', 'CONNECTIVITY'];
  },

  provideElectricVehicleCapability() {
    return {
      async setChargeLimit(device: Device, value: number) {
        await processCommandResponse(device, await client.setChargeLimits(device.providerId, value));
      },

      async setIsCharging(device: Device, value: boolean) {
        const response = value ? await client.startCharge(device.providerId) : await client.stopCharge(device.providerId);

        await processCommandResponse(device, response);
      },

      getNextChargeSchedule(device: Device): ScheduledCharge | null {
        const schedule = resolveNextChargeSchedule(device);

        if (schedule === null) {
          return null;
        }

        const startsAt = deadlineEngagesAt({
          schedule: { ...schedule, targetTime: new Date(schedule.targetTime) },
          deadlineEngageDays: config.vehicle.charge_deadline_engage_days,
        });

        return { ...schedule, startsAt: startsAt.toISOString() };
      },

      async setManualChargeSchedule(device: Device, schedule: ScheduleChargeRequest | null) {
        device.meta.chargeSchedule = schedule ? {
          targetPercentage: schedule.targetPercentage,
          targetTime: schedule.targetTime,
        } satisfies ScheduleChargeRequest : undefined;
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

      getChargeType(device: Device): ChargeType | null {
        const plan = getPlan(device);

        if (plan === null) {
          return null;
        }

        if (plan.deadline !== null) {
          return 'DEADLINE';
        }

        if (plan.target > config.vehicle.default_charge_limit) {
          return 'PLUNGE';
        }

        return 'BAU';
      },

      async getChargePriceCap(device: Device): Promise<number | null> {
        const chargePercentage = await device.getElectricVehicleCapability().getChargePercentage();
        const baselinePenceFor = await getBaselinePenceFor(new Date());

        return baselinePenceFor(chargePercentage);
      },

      async getChargePriceCapCurve(): Promise<{ chargePercentage: number; pence: number }[]> {
        const baselinePenceFor = await getBaselinePenceFor(new Date());

        return Array.from({ length: 101 }, (_, chargePercentage) => chargePercentage).flatMap((chargePercentage) => {
          const pence = baselinePenceFor(chargePercentage);

          return pence === null ? [] : [{ chargePercentage, pence }];
        });
      },
    };
  },

  synchronize,
});

async function clearNextChargeIfExpired(device: Device, now: Dayjs) {
  const stored = device.meta.chargeSchedule as ScheduleChargeRequest | undefined;

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

  const next = pickNextChargeSchedule(config.vehicle.charge_schedules ?? [], now);

  if (!next) {
    return;
  }

  device.meta.chargeSchedule = {
    targetPercentage: next.targetPercentage,
    targetTime: next.targetTime.toISOString(),
  } satisfies ScheduleChargeRequest;
}

// ---------------------------------------------------------------------------
// Price-aware charging
// ---------------------------------------------------------------------------

// A deadline block wants charging but the car isn't - since when, and have we
// alerted for it. Reset once it charges (or leaves the block).
let deadlineNotChargingSince: Dayjs | null = null;
let deadlineAlertSent = false;

async function getEnergyCostCapability() {
  const [device] = await Device.findByCapability('ENERGY_COST');

  if (device === undefined) {
    throw new Error('No ENERGY_COST device found to price charging against');
  }

  return device.getEnergyCostCapability();
}

async function getBaselinePenceFor(now: Date): Promise<(chargePercentage: number) => number | null> {
  const energyCost = await getEnergyCostCapability();
  const since = dayjs(now).subtract(config.vehicle.charge_baseline_history_days, 'day').toDate();
  const events = await energyCost.getUnitRateHistory({ since, until: now });
  // Sorted here rather than per call, since the plan asks for a bar once a slot.
  const pences = toPriceSlots(events, since, now).map(s => s.pence).sort((a, b) => a - b);
  const { charge_baseline_min_percentile: minP, charge_baseline_max_percentile: maxP, default_charge_limit: limit } = config.vehicle;

  // The percentile scales linearly from charge_baseline_max_percentile at 0% to
  // charge_baseline_min_percentile at default_charge_limit, so BAU accepts more
  // mediocre prices while the battery is low and holds out for genuine bargains
  // as it nears the limit. Clamped there since BAU never charges past the limit.
  return (chargePercentage: number) => {
    if (pences.length === 0) {
      return null;
    }

    const progress = Math.min(chargePercentage, limit) / limit;
    const rank = (maxP - (maxP - minP) * progress) / 100 * (pences.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);

    return pences[lo] + (pences[hi] - pences[lo]) * (rank - lo);
  };
}

function chargeRatePercentPerHour(): number {
  return (config.vehicle.charge_power_watts / 1000) / config.vehicle.battery_capacity_kwh * 100;
}

function getSchedule(device: Device): { targetPercentage: number; targetTime: Date } | null {
  const stored = device.meta.chargeSchedule as ScheduleChargeRequest | undefined;

  return stored === undefined ? null : {
    targetPercentage: stored.targetPercentage,
    targetTime: new Date(stored.targetTime),
  };
}

// charge_plan_mode=readonly: a non-prod instance against the shared physical car
// still plans and populates the UI / insights, it just doesn't command the car.
function isReadOnly(): boolean {
  return config.vehicle.charge_plan_mode === 'readonly';
}

// The scheduler owns start/stop; the car's own limit is pinned at 100 (see
// synchronize), so a start command always takes effect and this is just:
// charge while inside a planned slot and below target, otherwise stop. Re-issued
// each tick until the car reports it stuck.
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
  const baselinePenceFor = await getBaselinePenceFor(now.toDate());

  // With no forward prices this yields an empty plan and nothing charges until
  // they arrive, pending the admin acting on the Octopus alert.
  const plan = planCharge({
    slots,
    now: now.toDate(),
    chargePercentage,
    baselinePenceFor,
    schedule: getSchedule(device),
    chargeRatePercentPerHour: chargeRatePercentPerHour(),
    defaultLimit: config.vehicle.default_charge_limit,
    plungeLimit: config.vehicle.charge_plunge_limit,
    deadlineEngageDays: config.vehicle.charge_deadline_engage_days,
    startBufferHours: config.vehicle.charge_start_buffer_hours,
  });

  device.meta.chargePlan = {
    end: plan.end.toISOString(),
    publishedEnd: plan.publishedEnd.toISOString(),
    slots: plan.slots.map(s => ({ start: s.start.toISOString(), end: s.end.toISOString(), isEstimated: s.isEstimated })),
    target: plan.target,
    deadline: plan.deadline === null ? null : plan.deadline.toISOString(),
  } satisfies StoredChargePlan;

  await device.save();

  logger.info(`Price-aware charging: planned ${plan.slots.length} slot(s) to ${plan.target}%${plan.deadline === null ? '' : ` for ${plan.deadline.toISOString()}`}`);

  return plan;
}

// A plan is fixed so it can't jitter as prices are restated, with two exceptions.
//
// Prices reaching past where the plan's ran out - published or forecast - are
// strictly more information than it was built from. Agile publishes early
// afternoon, and business as usual only plans on published prices, so holding
// the old plan spends the evening on slots the new day beats outright.
//
// And a plan made while a deadline was still far off must not sit frozen while
// that deadline creeps into engagement range, or it is missed outright. A
// publication reaches further than a typical deadline lead time, so this is the
// common case rather than an edge one.
function needsReplan(device: Device, plan: ChargePlan, slots: PriceSlot[], now: Dayjs, chargePercentage: number): boolean {
  if (!now.isBefore(plan.end)) {
    return true;
  }

  const forecastEnd = slots.at(-1)?.end;
  const publishedEnd = slots.findLast(s => !s.isEstimated)?.end;

  if ((forecastEnd !== undefined && forecastEnd > plan.end) || (publishedEnd !== undefined && publishedEnd > plan.publishedEnd)) {
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
    deadlineEngageDays: config.vehicle.charge_deadline_engage_days,
    startBufferHours: config.vehicle.charge_start_buffer_hours,
  });
}

async function runPriceAwareCharging(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const [atHome, isCableConnected, chargePercentage] = await Promise.all([
    isAtHome(ev),
    ev.getIsCableConnected(),
    ev.getChargePercentage(),
  ]);

  // Away from home it's someone else's charger and tariff, so the car is left to
  // charge however it's been told to there.
  if (!atHome) {
    await clearPlan(device);

    deadlineNotChargingSince = null;
    deadlineAlertSent = false;
    return;
  }

  // Nothing can charge, and the plan is stale the moment the car leaves - it is
  // rebuilt from live SoC when the cable goes back in.
  if (!isCableConnected) {
    await clearPlan(device);
    await applyPlan(ev, now, null, chargePercentage);
    return;
  }

  const energyCost = await getEnergyCostCapability();
  // The deadline pass can engage up to this many days out, well past where
  // published prices reach, so the tail comes back forecast.
  const slots = await energyCost.getForwardUnitRates(
    dayjs(now).add(config.vehicle.charge_deadline_engage_days, 'day').toDate()
  );

  let plan = getPlan(device);

  if (plan === null || needsReplan(device, plan, slots, now, chargePercentage)) {
    plan = await createPlan(device, slots, now, chargePercentage);
  }

  await applyPlan(ev, now, plan, chargePercentage);
}

// Aligned ticks hit the half-hour slot boundaries exactly, so the 5-minute cadence
// is for what isn't aligned: reacting to the cable being plugged in, and stopping
// within five minutes of the charge limit rather than thirty.
// kia-connect-bridge serves the vehicle from memory, so polling it is cheap; how
// often it refreshes from Kia is its own setting.
nowAndSetCron(createBackgroundTransaction('vehicle:poll', refreshFromBridge), '* * * * *');

nowAndSetCron(createBackgroundTransaction('vehicle:charge-schedule', async () => {
  const device = await findVehicleDeviceOrError();
  const ev = device.getElectricVehicleCapability();
  const now = dayjs();

  await clearNextChargeIfExpired(device, now);
  await chooseNextCharge(device, now);
  await runPriceAwareCharging(device, ev, now);
}), '*/5 * * * *');

nowAndSetCron(createBackgroundTransaction('vehicle:monthly-mileage', async () => {
  const device = await findVehicleDeviceOrError();
  const capability = device.getElectricVehicleCapability();
  const startOfMonth = dayjs().startOf('month').toDate();
  const now = new Date();

  await ensureHistoricalMonthly(device, capability);
  await storeMonthlyAggregates(capability, startOfMonth, now, now);
}), '0 0 * * *');
