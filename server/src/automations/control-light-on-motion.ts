import { BooleanEvent, Device } from '../models';
import { isWithinTime } from '../helpers/time';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';

const offDelays = new Map();

type ControlLightOnMotionParameters = {
  sensors: { name: string; zone?: string | null }[];
  lightName: string;
  offDelaySeconds: number;
  between: ({
    start: string;
    end: string;
    illuminance?: number;
    brightness?: number;
  })[]
};

export default function ({ sensors, lightName, between = [{ start: '00:00', end: '00:00 + 1d' }], offDelaySeconds = 0 }: ControlLightOnMotionParameters) {
  // A group of sensors shares one light and one off-timer (keyed by lightName), so - like
  // multiple zones of one presence sensor - re-read every sensor's current state on any change
  // rather than trust the one event that fired, or two sensors changing near-simultaneously
  // could race each other's idea of whether the group is still occupied.
  async function isAnySensorOccupied(): Promise<boolean> {
    const states = await Promise.all(sensors.map(async ({ name, zone = null }) => {
      const device = await Device.findByNameOrError(name);
      return device.getMotionSensorCapability(zone).getHasMotion();
    }));

    return states.some(Boolean);
  }

  for (const { name, zone = null } of sensors) {
    DeviceCapabilityEvents.onMotionSensorHasMotionChanged(
      device => device.name === name,
      createBackgroundTransaction('automations:control-light-on-motion:motion-sensor-changed', async (event: BooleanEvent) => {
        if (event.instanceId !== zone) {
          return;
        }

        const sensor = await event.getDevice();

        for (const { start, end, illuminance = null, brightness = 100 } of between) {
          if (isWithinTime(start, end)) {
            const light = await Device.findByNameOrError(lightName);
            const lightIsOn = await light.getLightCapability().getIsOn();
            const belowIlluminanceThreshold = lightIsOn || illuminance === null || await sensor.getLightSensorCapability().getIlluminance() < illuminance;
            const lightDesiredOn = await isAnySensorOccupied() && belowIlluminanceThreshold;

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
}
