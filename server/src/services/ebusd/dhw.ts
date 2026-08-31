import { Device } from '../../models';
import { HeatPumpCapability, HeatPumpDHWMode, DHWPlannedWindow } from '../../models/capabilities';
import config from '../../config/app';
import dayjs from '../../dayjs';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import logger from '../../logger';
import EbusClient from './client';
import { toPriceSlots, findCheapestWindow, haveForecastThrough, CheapestWindow } from '../../helpers/prices';

// The current Auto plan: a single cheap block, written once and never revised
// until it rolls over.
let currentPlan: CheapestWindow | null = null;

function clearPlan() {
  currentPlan = null;
}

async function getEnergyCostCapability() {
  const devices = await Device.findByCapability('ENERGY_COST');

  if (devices.length === 0) {
    throw new Error('DHW scheduler: no ENERGY_COST device');
  }

  return devices[0].getEnergyCostCapability();
}

export function getPlannedDHWWindow(): DHWPlannedWindow | null {
  return currentPlan === null ? null : {
    start: currentPlan.start.toISOString(),
    end: currentPlan.end.toISOString(),
  };
}

// Whether Auto wants DHW enabled right now, planning a fresh block only when we
// hold a full horizon of forward prices. A plan, once written, is run as-is and
// never recalculated - so the block can't drift.
async function resolveAutoState(heatPump: HeatPumpCapability): Promise<boolean> {
  const now = new Date();

  if (currentPlan !== null && now < currentPlan.end) {
    return now >= currentPlan.start;
  }

  if (currentPlan !== null && now >= currentPlan.end) {
    clearPlan();
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

  currentPlan = window;
  logger.info(`DHW: scheduled cheap block ${window.start.toISOString()} - ${window.end.toISOString()} @ ${window.averagePence.toFixed(2)}p/kWh`);

  return now >= window.start && now < window.end;
}

// The single writer of HwcOpMode. Resolves the desired state in priority order
// and issues one ebusd write, only when it differs from the controller.
//
// dhw_plan_mode=readonly lets a non-prod instance run this loop against the shared
// physical heat pump without writing to it - it still resolves the plan (so the
// UI / insights reflect what it *would* do), it just doesn't touch HwcOpMode.
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
    // controller to revert HwcSFMode to `auto` itself when it's done.
    shouldBeOn = true;

    clearPlan();
  } else if (mode === 'OFF') {
    shouldBeOn = false;

    clearPlan();
  } else {
    shouldBeOn = await resolveAutoState(heatPump);
  }

  if (await heatPump.getDHWIsOn() !== shouldBeOn) {
    if (config.ebusd.dhw_plan_mode === 'readonly') {
      logger.info(`DHW: [readonly] would set HwcOpMode ${shouldBeOn ? 'manual' : 'off'}`);
    } else {
      await client.setDHWOpMode(shouldBeOn ? 'manual' : 'off');
    }
  }
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

nowAndSetInterval(
  createBackgroundTransaction('ebusd:dhw', reconcile),
  Math.max(config.ebusd.dhw_check_interval_minutes, 1) * 60 * 1000
);
