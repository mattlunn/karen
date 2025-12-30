import bus, { STAY_START } from '../bus';
import { isWithinTime } from '../helpers/time';
import { Device } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';

let offTimeout: ReturnType<typeof setTimeout>;

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
      const devicesToTurnOff: Device[] = [];

      for (const device of devices) {
        if (!await device.getLightCapability().getIsOn()) {
          device.getLightCapability().setIsOn(true);
          devicesToTurnOff.push(device);
        }
      }

      clearTimeout(offTimeout);
      
      offTimeout = setTimeout(async () => {
        await Promise.all(devicesToTurnOff.map(device => device.getLightCapability().setIsOn(false)));
      }, offDelayInMinutes * 60 * 1000);
    }
  }));
}