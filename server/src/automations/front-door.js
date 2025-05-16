import bus, { STAY_START } from '../bus';
import { Device } from '../models';
import { createBackgroundTransaction } from '../helpers/newrelic';

export default function ({ doorLockName }) {
  bus.on(STAY_START, createBackgroundTransaction('automations:front-door:stay-start', async (stay) => {
    if (stay.arrivalTrigger === 'geolocation') {
      const [
        device,
        user
      ] = Promise.all([
        await Device.findByName(doorLockName),
        await Stay.getUser(),
      ]);

      await device.getLockCapability().setIsLocked(false);

      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: `Unlocking the front door, as ${user.handle} has just got home`
      });
    }
  }));
}