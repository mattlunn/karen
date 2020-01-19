import bus, { EVENT_START, EVENT_END } from '../bus';
import { Device } from '../models';
import { isWithinTime } from '../helpers/time';

let timeoutToTurnOff;

export default function ({ sensorName, lightName, maximumHumidity, offDelaySeconds = 0, between = [{ start: '00:00', end: '23:59', brightness: 100 }] }) {
  [EVENT_START, EVENT_END].forEach((eventEvent) => {
    bus.on(eventEvent, async (event) => {
      const sensor = await event.getDevice();

      if (sensor.name === sensorName && (event.type === 'motion' || event.type === 'humidity')) {
        const light = await Device.findByName(lightName);
        const isLightOn = await light.getProperty('on');

        clearTimeout(timeoutToTurnOff);

        // If someone has just walked in turn the light on (if it isn't on already)
        if (event.type === 'motion' && eventEvent === EVENT_START) {
          const { brightness = 100 } = between.find(({ start, end }) => isWithinTime(start, end)) || {};

          if (!isLightOn) {
            await light.setProperty('brightness', brightness);
          }

        // Otherwise there is no more motion, or humidity has changed. In any of those
        // cases, set a timeout to possibly turn the light off if the humidity is low enough.
        } else {
          timeoutToTurnOff = setTimeout(async () => {
            const humidity = await sensor.getProperty('humidity');

            if (humidity < maximumHumidity) {
              await light.setProperty('on', false);
            }
          }, offDelaySeconds * 1000);
        }
      }
    });
  });
}