import bus, { EVENT_START, EVENT_END } from '../bus';
import { Device } from '../models';
import { isWithinTime } from '../helpers/time';

const offDelays = new Map();

export default function ({ sensorName, lightName, between, offDelaySeconds = 0 }) {
  [EVENT_START, EVENT_END].forEach((eventEvent) => {
    bus.on(eventEvent, async (event) => {
      if (event.type === 'motion') {
        if (Array.isArray(between) && !isWithinTime(between, event.start)) {
          return;
        }

        const sensor = await event.getDevice();

        if (sensor.name === sensorName) {
          const light = await Device.findByName(lightName);
          const lightIsOn = await light.getProperty('on');
          const lightDesiredOn = eventEvent === EVENT_START;

          clearTimeout(offDelays.get(lightName));

          if (lightDesiredOn && !lightIsOn) {
            light.setProperty('on', true);
          } else if (!lightDesiredOn && lightIsOn) {
            offDelays.set(lightName, setTimeout(() => {
              light.setProperty('on', false);
            }, offDelaySeconds * 1000));
          }
        }
      }
    });
  });
}