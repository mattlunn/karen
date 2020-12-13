import bus, { EVENT_START, EVENT_END } from '../bus';
import { Device } from '../models';
import { isWithinTime } from '../helpers/time';

const offDelays = new Map();

export default function ({ sensorName, lightName, between = [{ start: '00:00', end: '00:00 + 1d' }], offDelaySeconds = 0 }) {
  [EVENT_START, EVENT_END].forEach((eventEvent) => {
    bus.on(eventEvent, async (event) => {
      if (event.type === 'motion') {
        const sensor = await event.getDevice();

        if (sensor.name === sensorName) {
          for (const { start, end, illuminance = null, brightness = 100 } of between) {
            if (isWithinTime(start, end)) {
              const light = await Device.findByName(lightName);
              const lightIsOn = await light.getProperty('on');
              const belowIlluminanceThreshold = lightIsOn || illuminance === null || await sensor.getProperty('illuminance') < illuminance;
              const lightDesiredOn = eventEvent === EVENT_START && belowIlluminanceThreshold;

              clearTimeout(offDelays.get(lightName));

              if (lightDesiredOn && !lightIsOn) {
                light.setProperty('brightness', brightness);
              } else if (!lightDesiredOn && lightIsOn) {
                offDelays.set(lightName, setTimeout(() => {
                  light.setProperty('on', false);
                }, offDelaySeconds * 1000));
              }

              break;
            }
          }
        }
      }
    });
  });
}
