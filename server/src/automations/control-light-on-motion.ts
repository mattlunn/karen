import { BooleanEvent, Device } from '../models';
import { isWithinTime } from '../helpers/time';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';

const offDelays = new Map();

// Guards against two sensors' events racing each other to decide the same light's state.
// Every read leading up to the decision is side-effect-free, so it's fine for a
// soon-to-be-superseded invocation to run them all - it just must not act on what it finds
// if a newer invocation for the same light has shown up in the meantime, since that newer
// invocation is guaranteed to have started after every write that triggered an earlier,
// now-abandoned invocation for this light (that write is what caused the earlier invocation
// in the first place).
//
// This is a pure "am I still the last one to have claimed this light" identity check, not a
// time comparison - deliberately not the event's own timestamp value. A capability's
// stateTimestamp is captured before its DB write, not after, so a slow write can leave an
// earlier-starting event with a smaller timestamp than a later-starting one that resolved
// faster - comparing by value would then make the more-informed (later-invoked) handler
// defer to the staler one. A Symbol per invocation sidesteps that: it carries no time
// semantics to misuse, and is unique by construction.
const latestInvocationForLight = new Map<string, symbol>();

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

        const myInvocation = Symbol();
        latestInvocationForLight.set(lightName, myInvocation);

        const sensor = await event.getDevice();

        for (const { start, end, illuminance = null, brightness = 100 } of between) {
          if (isWithinTime(start, end)) {
            const light = await Device.findByNameOrError(lightName);
            const lightIsOn = await light.getLightCapability().getIsOn();
            const belowIlluminanceThreshold = lightIsOn || illuminance === null || await sensor.getLightSensorCapability().getIlluminance() < illuminance;
            const lightDesiredOn = await isAnySensorOccupied() && belowIlluminanceThreshold;

            if (latestInvocationForLight.get(lightName) !== myInvocation) {
              // A newer event for this light arrived while we were reading - defer to it.
              return;
            }

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
