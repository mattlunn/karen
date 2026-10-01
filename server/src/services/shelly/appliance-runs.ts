import dayjs from '../../dayjs';
import { Device, NumericEvent } from '../../models';
import { DeviceCapabilityEvents } from '../../models/capabilities';
import { createBackgroundTransaction } from '../../helpers/newrelic';

// Above the washing machine's 6W standby, below the dishwasher's 8W drying phase.
const RUN_THRESHOLD_WATTS = 7;
const START_AFTER_MINUTES = 5;
const END_AFTER_MINUTES = 10;

const pendingTransitions = new Map<number, NodeJS.Timeout>();

function isAppliance(device: Device): boolean {
  return device.provider === 'shelly' && device.getCapabilities().includes('APPLIANCE');
}

// Power events only fire on change, so a timer surviving its full delay means power held steady on that side of the threshold.
export function watchApplianceRuns(): void {
  DeviceCapabilityEvents.onEnergyMonitorCurrentPowerChanged(isAppliance, createBackgroundTransaction('shelly:appliance-runs:power-changed', async (event: NumericEvent) => {
    const device = await event.getDevice();
    const appliance = device.getApplianceCapability();
    const latestRun = await appliance.getIsRunningEvent();
    const isRunning = latestRun !== null && latestRun.end === null;
    const isAboveThreshold = event.value >= RUN_THRESHOLD_WATTS;

    if (isAboveThreshold === isRunning) {
      clearTimeout(pendingTransitions.get(device.id));
      pendingTransitions.delete(device.id);
      return;
    }

    if (pendingTransitions.has(device.id)) {
      return;
    }

    const delayMinutes = isAboveThreshold ? START_AFTER_MINUTES : END_AFTER_MINUTES;

    pendingTransitions.set(device.id, setTimeout(createBackgroundTransaction('shelly:appliance-runs:transition', async () => {
      pendingTransitions.delete(device.id);
      await appliance.setIsRunningState(isAboveThreshold, event.start, new Date());
    }), dayjs.duration(delayMinutes, 'minute').asMilliseconds()));
  }));
}
