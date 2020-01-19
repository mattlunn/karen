import bus, { EVENT_START, EVENT_END } from '../bus';
import { Device } from '../models';

let timeoutToTurnOff;

export default function ({ sensorName, lightName, maximumHumidity, offDelaySeconds = 0 }) {
  [EVENT_START, EVENT_END].forEach((eventEvent) => {
    bus.on(eventEvent, async (event) => {
      const sensor = await event.getDevice();

      if (sensor.name === sensorName && (event.type === 'motion' || event.type === 'humidity')) {
        const light = await Device.findByName(lightName);
        const isLightOn = await light.getProperty('on');

        clearTimeout(timeoutToTurnOff);

        // If someone has just walked in turn the light on (if it isn't on already)
        if (event.type === 'motion' && eventEvent === EVENT_START) {
          if (!isLightOn) {
            await light.setProperty('on', true);
          }

        // Otherwise there is no more motion, or humidity has changed. In any of those
        // cases, set a timeout to possibly turn the light off if the humidity is low enough.
        } else {
          timeoutToTurnOff = setTimeout(async () => {
            const humidity = await sensor.getProperty('humidity');

            console.log(`Seeing if ${humidity} < ${maximumHumidity}`);

            if (humidity < maximumHumidity) {
              await light.setProperty('on', false);
            }
          }, offDelaySeconds * 1000);
        }
      }
    });
  });
}