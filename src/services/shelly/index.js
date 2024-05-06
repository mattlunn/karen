import { Device } from '../../models';
import DeviceClient from './client/device';
import config from '../../config';

Device.registerProvider('shelly', {
  async setProperty(device, key, value) {
    switch (key) {
      default:
        throw new Error(`Unable to handle setting '${key}' for ${device.type}`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
      case 'connected':
        return true;
      case 'target':
      case 'temperature':
      case 'humidity':
      case 'power':
        return (await device.getLatestEvent(key)).value;
      case 'heating': {
        const latestEvent = await device.getLatestEvent(key);
        return !!latestEvent && !latestEvent.end;
      }
      default:
        throw new Error(`Unable to handle retrieving '${key}' for ${device.type}`);
    }
  },

  async synchronize() {
    const devices = await Device.findByProvider('shelly');

    for (const device of devices) {
      const shellyDevice = new DeviceClient(device.meta.endpoint, config.shelly.user, config.shelly.password);

      device.name = await shellyDevice.getDeviceName();

      await knownDevice.save();
    }
  }
});