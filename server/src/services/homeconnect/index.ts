import { Device } from '../../models';

Device.registerProvider('homeconnect', {
  getCapabilities(device) {
    return [];
  },

  async synchronize() {
    return Promise.resolve();
  }
});