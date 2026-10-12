import { Device } from '../../models';
import setCron from '../../helpers/set-cron';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import ApiClient from './lib/client';
import { getAccessToken } from './lib/auth';
import { getScheduledRun, scheduleForMeal, cancelScheduledRun, replanScheduledRun } from './dishwasher';

const client = new ApiClient(getAccessToken);

Device.registerProvider('homeconnect', {
  getCapabilities(device) {
    return device.model === 'Dishwasher' ? ['DISHWASHER'] : [];
  },

  provideDishwasherCapability() {
    return {
      getScheduledRun,
      scheduleForMeal: (device, meal) => scheduleForMeal(client, device, meal),
      cancelScheduledRun: (device) => cancelScheduledRun(client, device),
    };
  },

  async synchronize() {
    const dishwashers = (await client.getAppliances()).filter((appliance) => appliance.type === 'Dishwasher');

    for (const dishwasher of dishwashers) {
      let device = await Device.findByProviderId('homeconnect', dishwasher.haId);

      if (device === null) {
        device = Device.build({ provider: 'homeconnect', providerId: dishwasher.haId, name: dishwasher.name });
      }

      device.manufacturer = 'Home Connect';
      device.model = dishwasher.type;

      await device.save();
    }
  }
});

setCron(createBackgroundTransaction('homeconnect:replan-dishwasher', async () => {
  for (const device of await Device.findByProvider('homeconnect')) {
    await replanScheduledRun(client, device);
  }
}), '*/15 * * * *');
