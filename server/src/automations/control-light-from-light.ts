import { z } from 'zod';
import { Device } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';

export const parameters = z.object({
  controlName: z.string(),
  lightNames: z.array(z.string()).min(1)
});

export default function ({ controlName, lightNames }: z.infer<typeof parameters>) {
  DeviceCapabilityEvents.onLightIsOnChanged(
    device => device.name === controlName,
    createBackgroundTransaction('automations:control-light-from-light:control-changed', async () => {
      // Re-read rather than trust the event, so rapid toggles that resolve out of order still converge on the control's current state.
      const control = await Device.findByNameOrError(controlName);
      const isOn = await control.getLightCapability().getIsOn();

      await Promise.all(lightNames.map(async (lightName) => {
        const light = await Device.findByNameOrError(lightName);

        if (await light.getLightCapability().getIsOn() !== isOn) {
          await light.getLightCapability().setIsOn(isOn);
        }
      }));
    })
  );
}
