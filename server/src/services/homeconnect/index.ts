import { Device } from '../../models';
import config from '../../config';
import ApiClient from './lib/client';

Device.registerProvider('homeconnect', {
  getCapabilities(device) {
    return [];
  },

  async synchronize() {
    const client = new ApiClient(config.homeconnect);
    const appliances = await client.getAppliances();

    for (const appliance of appliances) {
      const device = await Device.findByProviderId('homeconnect', appliance.haId);

      if (!device) {
        await Device.create({
          provider: 'homeconnect',
          providerId: appliance.haId,
          name: appliance.name,
          type: appliance.type.toLowerCase()
        });
      }
    }
  }
});

const client = new ApiClient(config.homeconnect);

client.subscribeToEvents();