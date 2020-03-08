import bus, { EVENT_START, EVENT_END } from '../bus';
import { Device } from '../models';
import { isWithinTime } from '../helpers/time';

let timeoutToTurnOff = null;

// Motion starts; immediately turn light on. Cancel any scheduled timeouts
// Motion ends; schedule possible turnoff for light.
// Humidity changes;
//   If motion or timeout, ignore
//   Otherwise if new value > max, turn light on
//   Otherwise if new value < max, turn light off

export default function ({ sensorName, lightName, maximumHumidity, offDelaySeconds = 0, between = [{ start: '00:00', end: '23:59', brightness: 100 }] }) {
  [EVENT_START, EVENT_END].forEach((eventEvent) => {
    bus.on(eventEvent, async (event) => {
      const sensor = await event.getDevice();
      const light = await Device.findByName(lightName);

      if (sensor.name === sensorName) {
        if (event.type === 'motion') {
          if (eventEvent === EVENT_START) {
            const isLightOn = await light.getProperty('on');
            const { brightness = 100 } = between.find(({ start, end }) => isWithinTime(start, end)) || {};

            clearTimeout(timeoutToTurnOff);
            timeoutToTurnOff = null;

            if (!isLightOn) {
              await light.setProperty('brightness', brightness);
            }
          } else if (eventEvent === EVENT_END) {
            timeoutToTurnOff = setTimeout(async () => {
              const humidity = await sensor.getProperty('humidity');

              if (humidity < maximumHumidity) {
                await light.setProperty('on', false);
              }
            }, offDelaySeconds * 1000);
          }

        } else if (event.type === 'humidity' && eventEvent === EVENT_START) {
          const isSomeoneInRoom = await sensor.getProperty('motion');

          if (!isSomeoneInRoom && timeoutToTurnOff === null) {
            const desiredLightState = event.value > maximumHumidity;
            const actualLightState = await light.getProperty('on');

            if (desiredLightState !== actualLightState) {
              await light.setProperty('on', desiredLightState);
            }
          }
        }
      }
    });
  });
}