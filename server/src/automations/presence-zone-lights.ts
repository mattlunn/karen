import { BooleanEvent, Device } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';

// Two zones of one presence sensor, each with its own light:
//   both zones occupied  -> both lights on full
//   one zone occupied    -> that zone's light full, the other dimmed
//   neither occupied     -> both lights off, after a delay
//
// The dimmed light is anticipatory: it lights the space you're about to move
// into without being distracting while you're not in it.

let timeoutToTurnOff: undefined | ReturnType<typeof setTimeout> = undefined;

type PresenceZoneLightsParameters = {
  deviceName: string;
  zoneA: { zoneId: string; lightName: string };
  zoneB: { zoneId: string; lightName: string };
  dimBrightness?: number;
  offDelaySeconds?: number;
};

export default function ({ deviceName, zoneA, zoneB, dimBrightness = 50, offDelaySeconds = 0 }: PresenceZoneLightsParameters) {
  const zones = [zoneA, zoneB];

  async function setBrightness(lightName: string, brightness: number) {
    const light = await Device.findByNameOrError(lightName);
    const [isOn, currentBrightness] = await Promise.all([
      light.getLightCapability().getIsOn(),
      light.getLightCapability().getBrightness()
    ]);

    if (!isOn || currentBrightness !== brightness) {
      await light.getLightCapability().setBrightness(brightness);
    }
  }

  async function turnOff(lightName: string) {
    const light = await Device.findByNameOrError(lightName);

    if (await light.getLightCapability().getIsOn()) {
      await light.getLightCapability().setIsOn(false);
    }
  }

  DeviceCapabilityEvents.onMotionSensorHasMotionChanged(
    device => device.name === deviceName,
    createBackgroundTransaction('automations:presence-zone-lights:zone-changed', async (event: BooleanEvent) => {
      if (!zones.some(({ zoneId }) => zoneId === event.instanceId)) {
        return;
      }

      const sensor = await event.getDevice();

      // Re-read both zones rather than trusting this one event, so the two
      // zones can't disagree about what the current state is.
      const occupancy = await Promise.all(
        zones.map(({ zoneId }) => sensor.getMotionSensorCapability(zoneId).getHasMotion())
      );

      if (timeoutToTurnOff !== undefined) {
        clearTimeout(timeoutToTurnOff);
        timeoutToTurnOff = undefined;
      }

      if (occupancy.some(isOccupied => isOccupied)) {
        await Promise.all(zones.map(({ lightName }, i) => setBrightness(lightName, occupancy[i] ? 100 : dimBrightness)));
      } else {
        timeoutToTurnOff = setTimeout(createBackgroundTransaction('automations:presence-zone-lights:off-delay-elapsed', async () => {
          timeoutToTurnOff = undefined;

          await Promise.all(zones.map(({ lightName }) => turnOff(lightName)));
        }), offDelaySeconds * 1000);
      }
    })
  );
}
