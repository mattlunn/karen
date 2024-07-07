import bus, { EVENT_START, EVENT_END } from '../bus';
import { Device } from '../models';
import { isWithinTime } from '../helpers/time';
import { createBackgroundTransaction } from '../helpers/newrelic';

let timeoutToTurnOff = null;

// Motion starts; immediately turn light on. Cancel any scheduled timeouts
// Motion ends; schedule possible turnoff for light.
// Humidity changes;
//   If motion or timeout, ignore
//   Otherwise if new value > max, turn light on
//   Otherwise if new value < max, turn light off

export default function ({ motionSensorNames, humiditySensorName, lightName, maximumHumidity, offDelaySeconds = 0, between = [{ start: '00:00', end: '23:59', brightness: 100 }] }) {
  async function isSomeoneInRoom() {
    const sensors = await Device.findAll({ where: { name: motionSensorNames }});
    const sensorMotions = await Promise.all(sensors.map(sensor => sensor.getProperty('motion')));

    return sensorMotions.some(hasMotion => hasMotion);
  }

  async function getHumidityInRoom() {
    const humiditySensor = await Device.findByName(humiditySensorName);
    return humiditySensor.getProperty('humidity');
  }

  [EVENT_START, EVENT_END].forEach((eventEvent) => {
    bus.on(eventEvent, createBackgroundTransaction(`automations:bathroom:${eventEvent.toLowerCase()}`, async (event) => {
      const [sensor, light] = await Promise.all([
        event.getDevice(),
        Device.findByName(lightName)
      ]);

      if (sensor === null) {
        throw new Error(`Event ${event.id} does not have a matching event`);
      }

      if (motionSensorNames.includes(sensor.name)) {
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
          } else if (eventEvent === EVENT_END && !await isSomeoneInRoom()) {
            timeoutToTurnOff = setTimeout(async () => {
              const humidity = await getHumidityInRoom();

              timeoutToTurnOff = null;

              if (humidity < maximumHumidity) {
                await light.setProperty('on', false);
              } else {
                await light.setProperty('brightness', 1);
              }
            }, offDelaySeconds * 1000);
          }

        } else if (event.type === 'humidity' && eventEvent === EVENT_START) {
          if (!await isSomeoneInRoom() && timeoutToTurnOff === null) {
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
    }));
  });
}