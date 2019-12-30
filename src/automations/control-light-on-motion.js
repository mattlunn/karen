import bus, { EVENT_START, EVENT_END } from '../bus';
import { Device } from '../models';

export default function ({ sensorName, lightName }) {
  [EVENT_START, EVENT_END].forEach((eventEvent) => {
    bus.on(eventEvent, async (event) => {
      if (event.type === 'motion') {
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