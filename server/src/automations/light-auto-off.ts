import { z } from 'zod';
import dayjs from '../dayjs';
import { Log, type BooleanEvent } from '../models';
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

    DeviceCapabilityEvents.onLightIsOnChanged(
      device => device.name === lightName,
      createBackgroundTransaction('automations:light-auto-off:light-changed', async (event: BooleanEvent) => {
        clearTimeout(offTimeout);

        if (!event.hasEnded()) {
          const light = await event.getDevice();

          offTimeout = setTimeout(createBackgroundTransaction('automations:light-auto-off:turn-off', async () => {
            await light.getLightCapability().setIsOn(false);

            await Log.notify({
              severity: 'info',
              devices: [light],
              message: `Turning off ${light.name}, as it has been left on for ${offDelayMinutes} minutes`
            });
          }), dayjs.duration(offDelayMinutes, 'minute').asMilliseconds());
        }
      })
    );
  }
}
