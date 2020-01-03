import bus, { EVENT_START, EVENT_END } from '../bus';
import { Device } from '../models';
import { isWithinTime } from '../helpers/time';

export default function ({ sensorName, lightName, between }) {
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

          if (lightIsOn !== lightDesiredOn) {
            light.setProperty('on', lightDesiredOn);
          }
        }
      }
    });
  });
}