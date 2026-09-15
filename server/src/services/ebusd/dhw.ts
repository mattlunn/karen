import { Device } from '../../models';
import { HeatPumpCapability, HeatPumpDHWMode, DHWPlannedWindow, DHWTargetReason } from '../../models/capabilities';
import config from '../../config/app';
import dayjs from '../../dayjs';
import nowAndSetCron from '../../helpers/now-and-set-cron';
import setCron from '../../helpers/set-cron';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';
import logger from '../../logger';
import EbusClient, { Weekday, weekdayOf, legionellaDayToken } from './client';
import { toPriceSlots, findCheapestWindow, haveForecastThrough, CheapestWindow } from '../../helpers/prices';

// The current Auto plan: a single cheap block, written once and never revised
// until it rolls over. Persisted on device.meta rather than held in memory,
// because replanning needs a full forward-price horizon that isn't always
// available - a restart would otherwise drop the plan and be unable to rebuild it.
interface DHWPlan {
  start: Date;
  end: Date;
  targetTemp: number;
  reason: DHWTargetReason;
}

// device.meta is JSON, so the block's instants round-trip as ISO strings.
type StoredDHWPlan = Omit<DHWPlan, 'start' | 'end'> & { start: string; end: string };

function getPlan(device: Device): DHWPlan | null {
  const stored = device.meta.dhwPlan as StoredDHWPlan | undefined;

  return stored === undefined ? null : {
    ...stored,
    start: new Date(stored.start),
    end: new Date(stored.end),
  };
}

async function setPlan(device: Device, plan: DHWPlan): Promise<void> {
  device.meta.dhwPlan = {
    ...plan,
    start: plan.start.toISOString(),
    end: plan.end.toISOString(),
  } satisfies StoredDHWPlan;

  await device.save();
}

async function clearPlan(device: Device): Promise<void> {
  if (device.meta.dhwPlan !== undefined) {
    device.meta.dhwPlan = undefined;

    await device.save();
  }
}

async function getEnergyCostCapability() {
  const devices = await Device.findByCapability('ENERGY_COST');

  if (devices.length === 0) {
    throw new Error('DHW scheduler: no ENERGY_COST device');
  }

  return devices[0].getEnergyCostCapability();
}

export function getPlannedDHWWindow(device: Device): DHWPlannedWindow | null {
  const plan = getPlan(device);

  return plan === null ? null : {
    start: plan.start.toISOString(),
    end: plan.end.toISOString(),
    targetTemp: plan.targetTemp,
    reason: plan.reason,
  };
}

// The heat pump lands a degree or two below setpoint, so a reading this far
// under the target still counts as a completed pasteurising run.
function legionellaThreshold(): number {
  return config.ebusd.dhw_legionella_target_temp - config.ebusd.dhw_legionella_temp_tolerance;
}

// Start times of the cylinder heat-ups that reached legionella temperature in
// [since, until), most recent first (so `limit` keeps the newest).
export async function getLegionellaCycles(device: Device, since: Date, until: Date, limit?: number): Promise<Date[]> {
  const events = await device.getHeatPumpCapability().getDHWTemperatureHistory({
    since,
    until,
    value: { gte: legionellaThreshold() },
    limit,
  });

  return events.map(event => event.start);
}

async function resolveTarget(device: Device, window: CheapestWindow): Promise<{ targetTemp: number, reason: DHWTargetReason }> {
  const [lastCycle] = await getLegionellaCycles(
    device,
    dayjs().subtract(config.ebusd.dhw_legionella_max_interval_days, 'day').toDate(),
    new Date(),
    1,
  );

  if (lastCycle == null) {
    return { targetTemp: config.ebusd.dhw_legionella_target_temp, reason: 'LEGIONELLA' };
  }

  if (window.averagePence < 0) {
    return { targetTemp: config.ebusd.dhw_plunge_target_temp, reason: 'PLUNGE' };
  }

  return { targetTemp: config.ebusd.dhw_standard_target_temp, reason: 'STANDARD' };
}

// Cancels a leftover HwcLegionellaDay from a previous week's plan, but only
// when it's still pointing at `day` - a different day may be a genuinely
// pending legionella/plunge run and shouldn't be touched.
async function cancelStaleLegionellaSchedule(day: Weekday, client: EbusClient, readonly: boolean): Promise<void> {
  if (await client.getDHWLegionellaDay() !== legionellaDayToken(day)) {
    return;
  }

  if (readonly) {
    logger.info(`DHW: [readonly] would clear stale HwcLegionellaDay=${day}`);
  } else {
    await client.setDHWLegionellaDay('off');
  }
}

// Pushes a freshly-resolved plan into whichever native schedule executes it.
// A raised-target block rides the controller's own weekly legionella
// function (same mechanism for PLUNGE and LEGIONELLA - both just want a full
// pasteurising-grade charge, and PROD's plunge target already matches the
// legionella one); a standard block gets one slot in the weekly comfort
// timer, charging to whatever HwcTempDesired holds (which reconcile keeps
// pinned at the standard target). Neither is bounded by `plan.end` any more -
// completion is the controller's job, not Karen's.
async function applyScheduleFor(plan: DHWPlan, client: EbusClient, readonly: boolean): Promise<void> {
  const day = weekdayOf(plan.start);

  if (plan.reason === 'LEGIONELLA' || plan.reason === 'PLUNGE') {
    const time = dayjs(plan.start).format('HH:mm:ss');

    if (readonly) {
      logger.info(`DHW: [readonly] would set HwcLegionellaDay ${day}, HwcLegionellaTime ${time}`);
    } else {
      await client.setDHWLegionellaDay(day);
      await client.setDHWLegionellaTime(time);
    }

    return;
  }

  const from = dayjs(plan.start).format('HH:mm');
  const to = dayjs(plan.end).format('HH:mm');

  if (readonly) {
    logger.info(`DHW: [readonly] would set ${day} comfort slot ${from}-${to}`);
  } else {
    await client.setDHWComfortSchedule(day, from, to);
  }

  await cancelStaleLegionellaSchedule(day, client, readonly);
}

// No forecast yet (or nothing worth planning) - stay off rather than run
// blind, and cancel anything today's weekday was left scheduled to do from a
// previous week's plan, so a transient forecast gap can't leave a stale
// charge running on the controller's own clock.
async function standDownForToday(client: EbusClient, readonly: boolean): Promise<void> {
  const today = weekdayOf(new Date());

  if (readonly) {
    logger.info(`DHW: [readonly] no plan - would stand down ${today}'s schedule`);
  } else {
    await client.clearDHWComfortSchedule(today);
  }

  await cancelStaleLegionellaSchedule(today, client, readonly);
}

// Ensures a plan exists for the current price horizon, planning a fresh
// block only when we hold a full horizon of forward prices. A plan, once
// pushed into the controller's own schedule, is left to run as-is - Karen
// doesn't revisit HwcOpMode/HwcTempDesired minute-to-minute the way it used
// to, so the block can't drift and can't be second-guessed mid-charge.
async function syncPlan(device: Device, heatPump: HeatPumpCapability, client: EbusClient, readonly: boolean): Promise<void> {
  const now = new Date();
  const plan = getPlan(device);

  if (plan !== null && now < plan.end) {
    return;
  }

  if (plan !== null) {
    await clearPlan(device);
  }

  const horizonHours = config.ebusd.dhw_planning_horizon_hours;
  const until = dayjs(now).add(horizonHours, 'hour').toDate();

  const energyCost = await getEnergyCostCapability();
  const events = await energyCost.getUnitRateHistory({ since: now, until });

  // No full forward-price window yet - stay off. The octopus service raises the
  // admin alert if Agile prices are genuinely overdue.
  if (!haveForecastThrough(events, until)) {
    return standDownForToday(client, readonly);
  }

  const blockMinutes = await heatPump.getDHWMaxChargeTime();

  if (blockMinutes <= 0) {
    return standDownForToday(client, readonly);
  }

  const window = findCheapestWindow(toPriceSlots(events, now, until), blockMinutes, now, until);

  if (window === null) {
    return standDownForToday(client, readonly);
  }

  const { targetTemp, reason } = await resolveTarget(device, window);
  const newPlan: DHWPlan = { start: window.start, end: window.end, targetTemp, reason };

  await setPlan(device, newPlan);
  await applyScheduleFor(newPlan, client, readonly);

  logger.info(`DHW: scheduled ${reason} block ${window.start.toISOString()} - ${window.end.toISOString()} @ ${window.averagePence.toFixed(2)}p/kWh, target ${targetTemp}°C`);
}

async function setOpMode(client: EbusClient, readonly: boolean, mode: 'off' | 'time controlled'): Promise<void> {
  if (readonly) {
    logger.info(`DHW: [readonly] would set HwcOpMode ${mode}`);
  } else {
    await client.setDHWOpMode(mode);
  }
}

// The single writer of HwcOpMode outside of a boost. `time controlled` is
// what lets the controller's own weekly schedules (HwcLegionellaDay/Time,
// the comfort timer) actually execute - Karen no longer forces a live block
// by holding HwcOpMode in `manual`, so this and HwcTempDesired are asserted
// unconditionally each cycle (cheap, and self-heals e.g. after a boost ends
// leaves HwcOpMode in `manual`) rather than only on change.
//
// dhw_plan_mode=readonly lets a non-prod instance run this loop against the
// shared physical heat pump without writing to it - it still resolves the
// plan (so the UI / insights reflect what it *would* do), it just doesn't
// touch the controller.
async function reconcile(): Promise<void> {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const heatPump = device.getHeatPumpCapability();
  const readonly = config.ebusd.dhw_plan_mode === 'readonly';

  const [mode, isBoosting] = await Promise.all([
    heatPump.getDHWMode(),
    heatPump.getDHWBoost(),
  ]);

  if (isBoosting) {
    // A one-time load is running under its own control - setDHWBoost owns
    // HwcOpMode/HwcSFMode for the duration and reverts them itself. Leave it.
    return;
  }

  if (mode === 'OFF') {
    await clearPlan(device);
    await setOpMode(client, readonly, 'off');

    return;
  }

  await setOpMode(client, readonly, 'time controlled');

  if (readonly) {
    logger.info(`DHW: [readonly] would set HwcTempDesired ${config.ebusd.dhw_standard_target_temp}°C`);
  } else {
    await client.setDHWTargetTemp(config.ebusd.dhw_standard_target_temp);
  }

  await syncPlan(device, heatPump, client, readonly);
}

// Recovery is resolveTarget retrying a legionella block on each Auto cycle until
// it lands; this only tells admins when that still hasn't happened in time.
async function alertIfLegionellaOverdue(): Promise<void> {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const heatPump = device.getHeatPumpCapability();
  const days = config.ebusd.dhw_legionella_max_interval_days;

  // DHWMode=OFF deliberately suppresses the pasteurising run, so overdue is
  // expected then, not a fault.
  if (await heatPump.getDHWMode() === 'OFF') {
    return;
  }

  // resolveTarget schedules a catch-up run the moment it goes overdue, so wait
  // out the grace period for that to land before crying wolf.
  const lookbackDays = days + config.ebusd.dhw_legionella_alert_grace_days;
  const [lastCycle] = await getLegionellaCycles(device, dayjs().subtract(lookbackDays, 'day').toDate(), new Date(), 1);

  if (lastCycle != null) {
    return;
  }

  logger.warn(`DHW: hot water has not reached ${legionellaThreshold()}°C in over ${days} days`);

  bus.emit(NOTIFICATION_TO_ADMINS, {
    message: `🚨 Hot water has not reached ${legionellaThreshold()}°C in over ${days} days. The legionella cycle may be failing to complete.`,
  });
}

export async function setDHWMode(mode: HeatPumpDHWMode): Promise<void> {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');

  await device.getHeatPumpCapability().setDHWModeState(mode);
  await reconcile();
}

// `on` writes HwcSFMode = load - the same one-time cylinder charge the panel
// button triggers. HwcOpMode is forced to `manual` first so the circuit runs
// even when the base mode is OFF. The controller owns completion (it reverts
// HwcSFMode to `auto` at setpoint or when HwcMaxChargeTime expires), so there's
// no target, timeout or persisted state; `off` just hands it back to reconcile,
// which returns HwcOpMode to `time controlled` on its next run.
export async function setDHWBoost(on: boolean): Promise<void> {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const heatPump = device.getHeatPumpCapability();

  if (on) {
    await client.setDHWOpMode('manual');
    await client.setDHWSpecialFunction('load');

    await Promise.all([
      heatPump.setDHWBoostState(true),
      heatPump.setDHWIsOnState(true),
    ]);
  } else {
    await client.setDHWSpecialFunction('auto');
    await heatPump.setDHWBoostState(false);
  }

  await reconcile();
}

nowAndSetCron(
  createBackgroundTransaction('ebusd:dhw', reconcile),
  config.ebusd.dhw_check_cron
);

setCron(
  createBackgroundTransaction('ebusd:dhw-legionella-check', alertIfLegionellaOverdue),
  config.ebusd.dhw_legionella_alert_check_cron
);
