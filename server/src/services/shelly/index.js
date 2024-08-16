import { Device } from '../../models';
import DeviceClient from './client/device';
import config from '../../config';

Device.registerProvider('shelly', {
  async setProperty(device, key, value) {
    const shellyDevice = new DeviceClient(device.meta.endpoint, config.shelly.user, config.shelly.password);

    switch (key) {
      case 'on': {
        await shellyDevice.setIsOn(value);
        break;
      }
      case 'brightness': {
        await shellyDevice.setBrightness(value);
        break;
      }
      default:
        throw new Error(`Unable to handle setting '${key}' for ${device.type}`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
      case 'connected':
        return true;
      case 'on':
        return (await device.getLatestEvent(key))?.value ?? false;
      case 'brightness': {
        return (await device.getLatestEvent(key))?.value ?? 100;
      }
      default:
        throw new Error(`"${key}" is not a recognised property for Shelly`);
    }
  },

  async synchronize() {
    const devices = await Device.findByProvider('shelly');

    for (const device of devices) {
      const shellyDevice = new DeviceClient(device.meta.endpoint, config.shelly.user, config.shelly.password);

      device.name = await shellyDevice.getDeviceName();

      await device.save();
    }
  }
});