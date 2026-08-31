import { Device } from '../../models';
import { HeatPumpCapability } from '../../models/capabilities';
import config from '../../config/app';
import dayjs from '../../dayjs';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';
import logger from '../../logger';
import EbusClient from './client';
import { toPriceSlots, findCheapestWindow, coversWholeWindow, CheapestWindow } from '../../helpers/prices';
import type { DHWStatus, DHWHeatingMode } from '../../api/types';

export type DHWMode = DHWHeatingMode;

export type { DHWStatus };

// The current Auto plan: a single cheap block, written once and never revised
// until it rolls over. Also tracks how long we've been unable to plan, so the
// admin alert fires once rather than on every plan-less tick.
let currentPlan: CheapestWindow | null = null;
let noPlanSince: Date | null = null;
let noPlanAlertSent = false;

function clearPlan() {
  currentPlan = null;
}

function clearNoPlanTracking() {
  noPlanSince = null;
  noPlanAlertSent = false;
}

function normaliseMode(raw: string): DHWMode {
  return raw === 'AUTO' ? 'AUTO' : 'OFF';
}

async function getHeatPump(): Promise<{ device: Device; heatPump: HeatPumpCapability }> {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');

  return { device, heatPump: device.getHeatPumpCapability() };
}

async function getEnergyCostCapability() {
  const devices = await Device.findByCapability('ENERGY_COST');

  if (devices.length === 0) {
    throw new Error('DHW scheduler: no ENERGY_COST device');
  }

  return devices[0].getEnergyCostCapability();
}

export async function getDHWStatus(): Promise<DHWStatus> {
  const { heatPump } = await getHeatPump();
  const [mode, isBoosting] = await Promise.all([
    heatPump.getHotWaterMode(),
    heatPump.getDHWIsBoosting(),
  ]);

  return {
    mode: normaliseMode(mode),
    isBoosting,
    schedule: currentPlan === null ? null : {
      start: currentPlan.start.toISOString(),
      end: currentPlan.end.toISOString(),
      averagePence: currentPlan.averagePence,
    },
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

  const horizonHours = config.ebusd.dhw.planning_horizon_hours;
  const until = dayjs(now).add(horizonHours, 'hour').toDate();

  const energyCost = await getEnergyCostCapability();
  const events = await energyCost.getUnitRateHistory({ since: now, until });
  const slots = toPriceSlots(events, now, until);

  if (!coversWholeWindow(slots, now, until)) {
    markNoPlan(now);
    return false;
  }

  const blockMinutes = await heatPump.getDHWMaxChargeTime();

  if (blockMinutes <= 0) {
    markNoPlan(now);
    return false;
  }

  const window = findCheapestWindow(slots, blockMinutes, now, until);

  if (window === null) {
    markNoPlan(now);
    return false;
  }

  currentPlan = window;
  clearNoPlanTracking();
  logger.info(`DHW: scheduled cheap block ${window.start.toISOString()} - ${window.end.toISOString()} @ ${window.averagePence.toFixed(2)}p/kWh`);

  return now >= window.start && now < window.end;
}

function markNoPlan(now: Date) {
  if (noPlanSince === null) {
    noPlanSince = now;
  }

  if (!noPlanAlertSent && dayjs(now).diff(noPlanSince, 'hour', true) >= config.ebusd.dhw.no_plan_alert_hours) {
    noPlanAlertSent = true;

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `DHW cannot be scheduled for the next ${config.ebusd.dhw.planning_horizon_hours} hours. Use Boost if you need hot water.`,
    });
  }
}

// The single writer of HwcOpMode. Resolves the desired state in priority order
// and issues one ebusd write, only when it differs from the controller.
async function reconcile(): Promise<void> {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const { heatPump } = await getHeatPump();

  const [mode, isBoosting] = await Promise.all([
    heatPump.getHotWaterMode().then(normaliseMode),
    heatPump.getDHWIsBoosting(),
  ]);

  let shouldBeOn: boolean;

  if (isBoosting) {
    // A one-time load is running: hold the circuit enabled and leave the
    // controller to revert HwcSFMode to `auto` itself when it's done.
    shouldBeOn = true;
    clearPlan();
    clearNoPlanTracking();
  } else if (mode === 'OFF') {
    shouldBeOn = false;
    clearPlan();
    clearNoPlanTracking();
  } else {
    shouldBeOn = await resolveAutoState(heatPump);
  }

  if (await heatPump.getDHWIsOn() !== shouldBeOn) {
    await client.setDHWOpMode(shouldBeOn ? 'manual' : 'off');
  }
}

async function safeReconcile(): Promise<void> {
  try {
    await reconcile();
  } catch (e) {
    logger.error(e, 'DHW: reconcile failed');
  }
}

export async function setDHWMode(mode: DHWMode): Promise<void> {
  const { heatPump } = await getHeatPump();

  await heatPump.setHotWaterModeState(mode);
  await safeReconcile();
}

// Boost writes HwcSFMode = load - the same one-time cylinder charge the panel
// button triggers. HwcOpMode is set to `manual` first so the circuit is
// enabled even when the base mode is OFF. The controller owns completion (it
// reverts HwcSFMode to `auto` at setpoint or when HwcMaxChargeTime expires),
// so there's no target, timeout or persisted state here.
export async function startBoost(): Promise<void> {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const { heatPump } = await getHeatPump();

  await client.setDHWOpMode('manual');
  await client.setDHWSpecialFunction('load');

  await Promise.all([
    heatPump.setDHWIsBoostingState(true),
    heatPump.setDHWIsOnState(true),
  ]);

  await safeReconcile();
}

export async function cancelBoost(): Promise<void> {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const { heatPump } = await getHeatPump();

  await client.setDHWSpecialFunction('auto');
  await heatPump.setDHWIsBoostingState(false);

  await safeReconcile();
}

nowAndSetInterval(
  createBackgroundTransaction('ebusd:dhw', reconcile),
  Math.max(config.ebusd.dhw.check_interval_minutes, 1) * 60 * 1000
);
