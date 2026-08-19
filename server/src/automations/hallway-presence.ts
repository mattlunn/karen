import { BooleanEvent, Device } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';

// The hallway has two entrances. One is reached by leaving a zone the presence
// sensor watches (so a zone *clearing* is the signal someone is heading into
// the hallway); the other is covered by an ordinary motion sensor.
//
// Both triggers feed a single shared off-timer, which is why this owns the
// hallway light exclusively - two automations independently managing the same
// light's timer would race, one turning it off while the other still considers
// it active.

let timeoutToTurnOff: undefined | ReturnType<typeof setTimeout> = undefined;

type HallwayPresenceParameters = {
  deviceName: string;
  zoneIds: string[];
  motionSensorName: string;
  lightName: string;
  offDelaySeconds?: number;
};

export default function ({ deviceName, zoneIds, motionSensorName, lightName, offDelaySeconds = 0 }: HallwayPresenceParameters) {
  async function triggerLight() {
    const light = await Device.findByNameOrError(lightName);

    if (timeoutToTurnOff !== undefined) {
      clearTimeout(timeoutToTurnOff);
      timeoutToTurnOff = undefined;
    }

    if (!await light.getLightCapability().getIsOn()) {
      await light.getLightCapability().setBrightness(100);
    }

    timeoutToTurnOff = setTimeout(createBackgroundTransaction('automations:hallway-presence:off-delay-elapsed', async () => {
      timeoutToTurnOff = undefined;

      if (await light.getLightCapability().getIsOn()) {
        await light.getLightCapability().setIsOn(false);
      }
    }), offDelaySeconds * 1000);
  }

  // A watched zone clearing means someone left it - towards the hallway.
  DeviceCapabilityEvents.onMotionSensorHasMotionChanged(
    device => device.name === deviceName,
    createBackgroundTransaction('automations:hallway-presence:zone-changed', async (event: BooleanEvent) => {
      if (event.instanceId !== null && zoneIds.includes(event.instanceId) && event.hasEnded()) {
        await triggerLight();
      }
    })
  );

  // The hallway's other entrance.
  DeviceCapabilityEvents.onMotionSensorHasMotionChanged(
    device => device.name === motionSensorName,
    createBackgroundTransaction('automations:hallway-presence:motion-detected', async (event: BooleanEvent) => {
      if (!event.hasEnded()) {
        await triggerLight();
      }
    })
  );
}
