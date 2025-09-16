import { BooleanEvent, Device, NumericEvent } from '../models';
import { isWithinTime } from '../helpers/time';
import { DeviceCapabilityEvents } from '../models/capabilities';

let timeoutToTurnOff: undefined | ReturnType<typeof setTimeout> = undefined;

// Motion starts; immediately turn light on. Cancel any scheduled timeouts
// Motion ends; schedule possible turnoff for light.
// Humidity changes;
//   If motion or timeout, ignore
//   Otherwise if new value > max, turn light on
//   Otherwise if new value < max, turn light off

type BathroomAutomationParameters = {
  motionSensorNames: string[],
  humiditySensorName: string,
  lightName: string,
  maximumHumidity: number,
  offDelaySeconds?: number,
  between?: {
    start: string,
    end: string,
    brightness: number
  }[]
};

export default function ({ motionSensorNames, humiditySensorName, lightName, maximumHumidity, offDelaySeconds = 0, between = [{ start: '00:00', end: '23:59', brightness: 100 }] }: BathroomAutomationParameters) {
  async function isSomeoneInRoom() {
    const sensors = await Device.findAll({ where: { name: motionSensorNames }});
    const sensorMotions = await Promise.all(sensors.map(sensor => sensor.getMotionSensorCapability().getHasMotion()));

    return sensorMotions.some(hasMotion => hasMotion);
  }

  async function getHumidityInRoom(): Promise<number> {
    const humiditySensor = await Device.findByNameOrError(humiditySensorName);
    return humiditySensor.getHumiditySensorCapability().getHumidity();
  }

  DeviceCapabilityEvents.onMotionSensorHasMotionStart(async (event: BooleanEvent) => {
    const [sensor, light] = await Promise.all([
      event.getDevice(),
      Device.findByNameOrError(lightName)
    ]);

    if (motionSensorNames.includes(sensor.name)) {
      const [isLightOn, currentBrightness] = await Promise.all([
        light.getLightCapability().getIsOn(),
        light.getLightCapability().getBrightness()
      ]);

      const { brightness: desiredBrightness = 100 } = between.find(({ start, end }) => isWithinTime(start, end)) || {};

      if (timeoutToTurnOff !== undefined) {
        clearTimeout(timeoutToTurnOff);
        timeoutToTurnOff = undefined;
      }

      if (!isLightOn || desiredBrightness !== currentBrightness) {
        await light.getLightCapability().setBrightness(desiredBrightness);
      }
    }
  });

  DeviceCapabilityEvents.onMotionSensorHasMotionEnd(async (event: BooleanEvent) => {
    const [sensor, light] = await Promise.all([
      event.getDevice(),
      Device.findByNameOrError(lightName)
    ]);

    if (motionSensorNames.includes(sensor.name) && !await isSomeoneInRoom()) {
      timeoutToTurnOff = setTimeout(async () => {
        const humidity = await getHumidityInRoom();

        timeoutToTurnOff = undefined;

        if (humidity < maximumHumidity) {
          await light.getLightCapability().setIsOn(false);
        } else {
          await light.getLightCapability().setBrightness(1);
        }
      }, offDelaySeconds * 1000);
    }
  });

  DeviceCapabilityEvents.onHumiditySensorHumidityChanged(async (event: NumericEvent) => {
    const light = await Device.findByNameOrError(lightName);

    if (!await isSomeoneInRoom() && timeoutToTurnOff === null) {
      const desiredLightState = event.value > maximumHumidity;
      const actualLightState = await light.getLightCapability().getIsOn();

      if (desiredLightState === true && actualLightState === false) {
        await light.getLightCapability().setBrightness(1);
      } else if (desiredLightState === false && actualLightState === true) {
        await light.getLightCapability().setIsOn(false);
      }
    }
  });
}