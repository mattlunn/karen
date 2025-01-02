import bus, { EVENT_START, EVENT_END } from '../bus';
import { Device } from '../models';
import { isWithinTime } from '../helpers/time';
import { createBackgroundTransaction } from '../helpers/newrelic';

const offDelays = new Map();

export default function ({ sensorName, lightName, between = [{ start: '00:00', end: '00:00 + 1d' }], offDelaySeconds = 0 }) {
  [EVENT_START, EVENT_END].forEach((eventEvent) => {
    bus.on(eventEvent, createBackgroundTransaction(`automations:control-light-on-motion:${eventEvent.toLowerCase()}`, async (event) => {
      if (event.type === 'motion') {
        const sensor = await event.getDevice();

        if (sensor.name === sensorName) {
          for (const { start, end, illuminance = null, brightness = 100 } of between) {
            if (isWithinTime(start, end)) {
              const light = await Device.findByName(lightName);
              const lightIsOn = await light.getLightCapability().getIsOn();
              const belowIlluminanceThreshold = lightIsOn || illuminance === null || await sensor.getLightSensorCapability().getIlluminance() < illuminance;
              const lightDesiredOn = eventEvent === EVENT_START && belowIlluminanceThreshold;

              clearTimeout(offDelays.get(lightName));

              if (lightDesiredOn && !lightIsOn) {
                light.getLightCapability().setBrightness(brightness);
              } else if (!lightDesiredOn && lightIsOn) {
                offDelays.set(lightName, setTimeout(() => {
                  light.getLightCapability().setIsOn(false);
                }, offDelaySeconds * 1000));
              }

              break;
            }
          }
        }
      }
    }));
  });
}
