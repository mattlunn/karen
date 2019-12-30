import bus, { EVENT_START } from '../bus';
import { Device } from '../models';
import { sendNotification } from '../helpers/notification';

export default function ({ thermostatName, lightName, sensorName, maximumHumidity }) {
  bus.on(EVENT_START, async (event) => {
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

        const isDoorClosed = !await sensor.getProperty('open');
        const isLightOn = await light.getProperty('on');
        const isTooHumid = event.value > maximumHumidity;

        if (isDoorClosed && isTooHumid !== isLightOn) {
          sendNotification(`Turning ${lightName} ${isTooHumid ? 'on' : 'off'} as humidity is ${event.humidity}`);

          await light.setProperty('on', isTooHumid);
        }
      }
    }
  });
}