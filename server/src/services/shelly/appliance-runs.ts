import dayjs from '../../dayjs';
import { Device, NumericEvent } from '../../models';
import { DeviceCapabilityEvents } from '../../models/capabilities';
import logger from '../../logger';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import { decide, PowerReading, RUN_THRESHOLD_WATTS, START_AFTER_MINUTES, END_AFTER_MINUTES } from './appliance-run-transition';

const pendingChecks = new Map<number, NodeJS.Timeout>();

function scheduleCheck(device: Device, delayMinutes: number): void {
  if (pendingChecks.has(device.id)) {
    return;
  }

  pendingChecks.set(device.id, setTimeout(createBackgroundTransaction('shelly:appliance-runs:check', async () => {
    pendingChecks.delete(device.id);

    try {
      await checkForRunTransition(device);
    } catch (e) {
      logger.error(e, `Failed to check appliance run for shelly device ${device.id}`);
    }
  }), dayjs.duration(delayMinutes, 'minute').asMilliseconds()));
}

async function checkForRunTransition(device: Device): Promise<void> {
  const appliance = device.getApplianceCapability();
  const latestRun = await appliance.getIsRunningEvent();
  const runStartedAt = latestRun !== null && latestRun.end === null ? latestRun.start : null;
  const now = new Date();
  const since = dayjs(now).subtract(END_AFTER_MINUTES, 'minute').toDate();
  const history = await device.getEnergyMonitorCapability().getCurrentPowerHistory({ since, until: now });
  const readings = history.map(event => ({ start: event.start, value: event.value }));
  const transition = decide(readings, runStartedAt, now);

  if (transition !== null) {
    await appliance.setIsRunningState(transition.isRunning, transition.at, now);
  }

  const isRunning = transition?.isRunning ?? runStartedAt !== null;
  const latestReading = readings.reduce<PowerReading | null>((latest, reading) => latest === null || reading.start > latest.start ? reading : latest, null);

  // Power readings only arrive on change, so a steady reading would otherwise never trigger the next check.
  if (isRunning) {
    scheduleCheck(device, END_AFTER_MINUTES);
  } else if (latestReading !== null && latestReading.value >= RUN_THRESHOLD_WATTS) {
    scheduleCheck(device, START_AFTER_MINUTES);
  }
}

function isAppliance(device: Device): boolean {
  return device.provider === 'shelly' && device.getCapabilities().includes('APPLIANCE');
}

export async function watchApplianceRuns(): Promise<void> {
  DeviceCapabilityEvents.onEnergyMonitorCurrentPowerChanged(isAppliance, createBackgroundTransaction('shelly:appliance-runs:power-changed', async (event: NumericEvent) => {
    scheduleCheck(await event.getDevice(), event.value >= RUN_THRESHOLD_WATTS ? START_AFTER_MINUTES : END_AFTER_MINUTES);
  }));

  const devices = await Device.findByProvider('shelly');

  for (const device of devices.filter(isAppliance)) {
    scheduleCheck(device, 0);
  }
}
