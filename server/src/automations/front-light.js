import bus, { STAY_START } from '../bus';
import { isWithinTime } from '../helpers/time';
import { Device } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';

let offTimeout;

export default function ({ offDelayInMinutes, start, end, lightNames }) {
  bus.on(STAY_START, createBackgroundTransaction('automations:front-light:stay-start', async () => {
    if (isWithinTime(start, end)) {
      const devices = await Promise.all(lightNames.map(x => Device.findByName(lightName)));
      const devicesToTurnOff = [];

      for (const device of devices) {
        if (!await device.getLightCapability().getIsOn()) {
          device.getLightCapability().setIsOn(true);
          devicesToTurnOff.push(device);
        }
      }

      clearTimeout(offTimeout);
      setTimeout(async () => {
        await Promise.all(devicesToTurnOff.map(x => device.getLightCapability().setIsOn(false)));
      }, offDelayInMinutes * 60 * 1000);
    }
  }));
}