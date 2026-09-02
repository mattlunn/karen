import { Device } from '../../models';
import { HeatPumpCapability, HeatPumpDHWMode, DHWPlannedWindow, DHWTargetReason } from '../../models/capabilities';
import config from '../../config/app';
import dayjs from '../../dayjs';
import nowAndSetCron from '../../helpers/now-and-set-cron';
import setCron from '../../helpers/set-cron';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';
import logger from '../../logger';
import EbusClient from './client';
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

// Whether Auto wants DHW enabled right now, planning a fresh block only when we
// hold a full horizon of forward prices. A plan, once written, is run as-is and
// never recalculated - so the block can't drift.
async function resolveAutoState(device: Device, heatPump: HeatPumpCapability): Promise<boolean> {
  const now = new Date();
  const plan = getPlan(device);

  if (plan !== null && now < plan.end) {
    return now >= plan.start;
  }

  if (plan !== null && now >= plan.end) {
    await clearPlan(device);
  }

  const horizonHours = config.ebusd.dhw_planning_horizon_hours;
  const until = dayjs(now).add(horizonHours, 'hour').toDate();

  const energyCost = await getEnergyCostCapability();
  const events = await energyCost.getUnitRateHistory({ since: now, until });

  // No full forward-price window yet - stay off. The octopus service raises the
  // admin alert if Agile prices are genuinely overdue.
  if (!haveForecastThrough(events, until)) {
    return false;
  }

  const blockMinutes = await heatPump.getDHWMaxChargeTime();

  if (blockMinutes <= 0) {
    return false;
  }

  const window = findCheapestWindow(toPriceSlots(events, now, until), blockMinutes, now, until);

  if (window === null) {
    return false;
  }

  const { targetTemp, reason } = await resolveTarget(device, window);

  await setPlan(device, { start: window.start, end: window.end, targetTemp, reason });
  logger.info(`DHW: scheduled ${reason} block ${window.start.toISOString()} - ${window.end.toISOString()} @ ${window.averagePence.toFixed(2)}p/kWh, target ${targetTemp}°C`);

  return now >= window.start && now < window.end;
}

// The single writer of HwcOpMode and HwcTempDesired. Resolves the desired state
// in priority order and issues one ebusd write each, only when it differs from
// the controller.
//
// dhw_plan_mode=readonly lets a non-prod instance run this loop against the
// shared physical heat pump without writing to it - it still resolves the plan
// (so the UI / insights reflect what it *would* do), it just doesn't touch the
// controller.
async function reconcile(): Promise<void> {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const heatPump = device.getHeatPumpCapability();

  const [mode, isBoosting] = await Promise.all([
    heatPump.getDHWMode(),
    heatPump.getDHWBoost(),
  ]);

  let shouldBeOn: boolean;

  if (isBoosting) {
    // A one-time load is running: hold the circuit enabled and leave the
    // controller to revert HwcSFMode to `auto` itself when it's done. The plan
    // stands - a boost is a transient override of what's happening now, not a
    // change to the day's schedule, and a boost only reaches the standard
    // setpoint so it can't stand in for a raised-target block.
    shouldBeOn = true;
  } else if (mode === 'OFF') {
    shouldBeOn = false;

    await clearPlan(device);
  } else {
    shouldBeOn = await resolveAutoState(device, heatPump);
  }

  const readonly = config.ebusd.dhw_plan_mode === 'readonly';
  const plan = getPlan(device);
  const blockIsLive = plan !== null && Date.now() >= plan.start.getTime() && Date.now() < plan.end.getTime();

  // The plan's setpoint applies only while its block is live. Outside it - a
  // block still ahead, a finished block, or a boost running on its own -
  // HwcTempDesired drops back to standard rather than sitting at plunge/legionella temp.
  const desiredTargetTemp = (shouldBeOn && blockIsLive)
    ? plan.targetTemp
    : config.ebusd.dhw_standard_target_temp;

  // Write the setpoint before enabling the circuit, so a raised-target block
  // heats towards it from the start rather than after the next reconcile.
  if (await client.getDHWTargetTemp() !== desiredTargetTemp) {
    if (readonly) {
      logger.info(`DHW: [readonly] would set HwcTempDesired ${desiredTargetTemp}°C`);
    } else {
      await client.setDHWTargetTemp(desiredTargetTemp);
    }
  }

  if (await heatPump.getDHWIsOn() !== shouldBeOn) {
    if (readonly) {
      logger.info(`DHW: [readonly] would set HwcOpMode ${shouldBeOn ? 'manual' : 'off'}`);
    } else {
      await client.setDHWOpMode(shouldBeOn ? 'manual' : 'off');
    }
  }
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
// no target, timeout or persisted state; `off` just hands it back.
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
