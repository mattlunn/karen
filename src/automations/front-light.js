import bus, { STAY_START } from '../bus';
import { isWithinTime } from '../helpers/time';
import { Device } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';

let offTimeout;
let offExecutionTime;

function turnOffAfter(device, delayInMs) {
  const turnOffTime = Date.now() + delayInMs;

  if (offExecutionTime && offExecutionTime > turnOffTime) {
    return;
  }

  clearTimeout(offTimeout);

  offExecutionTime = turnOffTime;
  offTimeout = setTimeout(() => {
    device.setProperty('on', false);
  }, delayInMs);
}

export default function ({ offDelayInMinutes, start, end, lightName }) {
  bus.on(STAY_START, createBackgroundTransaction('automations:front-light:stay-start', async () => {
    if (isWithinTime(start, end)) {
      const device = await Device.findByName(lightName);

      if (!await device.getProperty('on')) {
        device.setProperty('on', true);

        turnOffAfter(device, offDelayInMinutes * 60000);
      }
    }
  }));
}