import bus, { EVENT_START } from '../bus';
import { Device } from '../models';
import { sendNotification } from '../helpers/notification';
import { createBackgroundTransaction } from '../helpers/newrelic';

export default function ({ thermostatName, lightName, sensorName, maximumHumidity }) {
  bus.on(EVENT_START, createBackgroundTransaction('automations:utility-humidity:event-start', async (event) => {
    if (event.type === 'humidity') {
      const thermostat = await event.getDevice();

      if (thermostat.name === thermostatName) {
        const [
          light,
          sensor
        ] = await Promise.all([
          Device.findByName(lightName),
          Device.findByName(sensorName)
        ]);

        const hasMotion = await sensor.getProperty('motion');
        const isLightOn = await light.getProperty('on');
        const isTooHumid = event.value > maximumHumidity;

        if (!hasMotion && isTooHumid !== isLightOn) {
          sendNotification(`Turning ${lightName} ${isTooHumid ? 'on' : 'off'} as humidity is ${event.value}%`);

          await light.setProperty('on', isTooHumid);
        }
      }
    }
  }));
}