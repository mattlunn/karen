import { BooleanEvent, Device } from '../models';
import { isWithinTime } from '../helpers/time';
import { DeviceCapabilityEvents } from '../models/capabilities';

const offDelays = new Map();

type ControlLightOnMotionParameters = {
  sensorName: string;
  lightName: string;
  offDelaySeconds: number;
  between: ({
    start: string;
    end: string;
    illuminance?: number;
    brightness?: number;
  })[]
};

export default function ({ sensorName, lightName, between = [{ start: '00:00', end: '00:00 + 1d' }], offDelaySeconds = 0 }: ControlLightOnMotionParameters) {
  DeviceCapabilityEvents.onMotionSensorHasMotionStart(async (event: BooleanEvent) => {
    const sensor = await event.getDevice();

    if (sensor.name === sensorName) {
      for (const { start, end, illuminance = null, brightness = 100 } of between) {
        if (isWithinTime(start, end)) {
          const light = await Device.findByNameOrError(lightName);
          const lightIsOn = await light.getLightCapability().getIsOn();
          const belowIlluminanceThreshold = lightIsOn || illuminance === null || await sensor.getLightSensorCapability().getIlluminance() < illuminance;
          const lightDesiredOn = eventEvent === EVENT_START && belowIlluminanceThreshold;

          clearTimeout(offDelays.get(lightName));

          if (lightDesiredOn && !lightIsOn) {
            light.getLightCapability().setBrightness(brightness);
          } else if (!lightDesiredOn && lightIsOn) {
            offDelays.set(lightName, setTimeout(() => {
              light.getLightCapability().setIsOn(false);
            }, offDelaySeconds * 1000));
          }

          break;
        }
      }
    }
  });
}
