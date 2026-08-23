import bus, { STAY_START } from '../bus';
import { isWithinTime } from '../helpers/time';
import { Device } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';

let offTimeout: ReturnType<typeof setTimeout>;

// Shared across overlapping STAY_START calls (e.g. two people arriving within
// offDelayInMinutes of each other) so a later call doesn't clear an earlier
// call's pending turn-off without taking over responsibility for those lights.
const devicesToTurnOff = new Map<number, Device>();

type FrontLightAutomationParameters = {
  offDelayInMinutes: number;
  start: string;
  end: string;
  lightNames: string[];
};

export default function ({ offDelayInMinutes, start, end, lightNames }: FrontLightAutomationParameters) {
  bus.on(STAY_START, createBackgroundTransaction('automations:front-light:stay-start', async () => {
    if (isWithinTime(start, end)) {
      const devices = await Promise.all(lightNames.map(lightName => Device.findByNameOrError(lightName)));

      for (const device of devices) {
        if (!await device.getLightCapability().getIsOn()) {
          device.getLightCapability().setIsOn(true);
          devicesToTurnOff.set(device.id, device);
        }
      }

      clearTimeout(offTimeout);

      offTimeout = setTimeout(async () => {
        const devices = [...devicesToTurnOff.values()];

        devicesToTurnOff.clear();

        await Promise.all(devices.map(device => device.getLightCapability().setIsOn(false)));
      }, offDelayInMinutes * 60 * 1000);
    }
  }));
}