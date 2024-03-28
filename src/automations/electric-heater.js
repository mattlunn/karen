import bus, { EVENT_START, EVENT_END } from '../bus';
import { Device } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';

export default function ({ thermostatName, heaterName }) {
  [EVENT_START, EVENT_END].forEach((eventStatus) => {
    bus.on(eventStatus, createBackgroundTransaction(`automations:electric-heater`, async (event) => {
      const [sensor, heater] = await Promise.all([
        event.getDevice(),
        Device.findByName(heaterName)
      ]);

      if (sensor.name === thermostatName && event.type === 'heating') {
        console.log(`Setting ${heater.name} to ${event.end ? 'off' : 'on'}`);

        heater.setProperty('on', !event.end);
      }
    }));
  });
}