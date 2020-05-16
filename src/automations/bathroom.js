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
      const [sensor, light] = await Promise.all([
        event.getDevice(),
        Device.findByName(lightName)
      ]);

      if (sensor.name === sensorName) {
        if (event.type === 'motion') {
          if (eventEvent === EVENT_START) {
            const [isLightOn, currentBrightness] = await Promise.all([
              light.getProperty('on'),
              light.getProperty('brightness')
            ]);

            const { brightness: desiredBrightness = 100 } = between.find(({ start, end }) => isWithinTime(start, end)) || {};

            clearTimeout(timeoutToTurnOff);
            timeoutToTurnOff = null;

            if (!isLightOn || desiredBrightness !== currentBrightness) {
              await light.setProperty('brightness', desiredBrightness);
            }
          } else if (eventEvent === EVENT_END) {
            timeoutToTurnOff = setTimeout(async () => {
              const humidity = await sensor.getProperty('humidity');

              timeoutToTurnOff = null;

              if (humidity < maximumHumidity) {
                await light.setProperty('on', false);
              } else {
                await light.setProperty('brightness', 1);
              }
            }, offDelaySeconds * 1000);
          }

        } else if (event.type === 'humidity' && eventEvent === EVENT_START) {
          const isSomeoneInRoom = await sensor.getProperty('motion');

          if (!isSomeoneInRoom && timeoutToTurnOff === null) {
            const desiredLightState = event.value > maximumHumidity;
            const actualLightState = await light.getProperty('on');

            if (desiredLightState === true && actualLightState === false) {
              await light.setProperty('brightness', 1);
            } else if (desiredLightState === false && actualLightState === true) {
              await light.setProperty('on', false);
            }
          }
        }
      }
    });
  });
}