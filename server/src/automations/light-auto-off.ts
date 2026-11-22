import { z } from 'zod';
import dayjs from '../dayjs';
import { BooleanEvent, Device } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';

export const parameters = z.object({
  lights: z.array(z.object({
    lightName: z.string(),
    offDelayMinutes: z.number().positive()
  })).min(1)
});

export default function ({ lights }: z.infer<typeof parameters>) {
  for (const { lightName, offDelayMinutes } of lights) {
    let offTimeout: ReturnType<typeof setTimeout> | undefined;

    function scheduleOff(light: Device, onSince: Date): void {
      clearTimeout(offTimeout);

      offTimeout = setTimeout(createBackgroundTransaction('automations:light-auto-off:turn-off', async () => {
        await light.getLightCapability().setIsOn(false);
      }), Math.max(0, dayjs(onSince).add(offDelayMinutes, 'minute').diff(dayjs())));
    }

    DeviceCapabilityEvents.onLightIsOnChanged(
      device => device.name === lightName,
      createBackgroundTransaction('automations:light-auto-off:light-changed', async (event: BooleanEvent) => {
        clearTimeout(offTimeout);

        if (!event.hasEnded()) {
          scheduleOff(await event.getDevice(), event.start);
        }
      })
    );

    // A light left on across a restart never fires a new on event, so pick it up from its current state.
    createBackgroundTransaction('automations:light-auto-off:startup', async () => {
      const light = await Device.findByNameOrError(lightName);
      const isOnEvent = await light.getLightCapability().getIsOnEvent();

      if (isOnEvent !== null && !isOnEvent.hasEnded()) {
        scheduleOff(light, isOnEvent.start);
      }
    })().catch(() => {
      // Already logged and reported by createBackgroundTransaction.
    });
  }
}
