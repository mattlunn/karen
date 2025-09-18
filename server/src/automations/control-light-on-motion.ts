import { BooleanEvent, Device } from '../models';
import { isWithinTime } from '../helpers/time';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';

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
  DeviceCapabilityEvents.onMotionSensorHasMotionChanged(
    device => device.name === sensorName, 
    createBackgroundTransaction('automations:control-light-on-motion:motion-sensor-changed', async (event: BooleanEvent) => {
      const sensor = await event.getDevice();

      for (const { start, end, illuminance = null, brightness = 100 } of between) {
        if (isWithinTime(start, end)) {
          const light = await Device.findByNameOrError(lightName);
          const lightIsOn = await light.getLightCapability().getIsOn();
          const belowIlluminanceThreshold = lightIsOn || illuminance === null || await sensor.getLightSensorCapability().getIlluminance() < illuminance;
          const lightDesiredOn = !event.hasEnded() && belowIlluminanceThreshold;

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
    })
  );
}
