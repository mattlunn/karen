import { z } from 'zod';
import bus, { STAY_START, NOTIFICATION_TO_ADMINS } from '../bus';
import { Device, Stay } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';

export const parameters = z.object({
  doorLockName: z.string()
});

export default function ({ doorLockName }: z.infer<typeof parameters>) {
  bus.on(STAY_START, createBackgroundTransaction('automations:front-door:stay-start', async (stay: Stay) => {
    if (stay.arrivalTrigger === 'geolocation') {
      const [
        device,
        user
      ] = await Promise.all([
        Device.findByNameOrError(doorLockName),
        stay.getUser(),
      ]);

      await device.getLockCapability().setIsLocked(false);

      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: `Unlocking the front door, as ${user.handle} has just got home`
      });
    }
  }));
}
