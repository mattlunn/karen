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
        await Promise.all([
          shellyDevice.setBrightness(value),
          shellyDevice.setIsOn(value > 0)
        ]);

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
      case 'on': {
        const latestEvent = await device.getLatestEvent(key);
        return !!(latestEvent && !latestEvent.end);
      }
      case 'brightness': {
        return (await device.getLatestEvent(key))?.value ?? 100;
      }
      default:
        throw new Error(`"${key}" is not a recognised property for Shelly`);
    }
  },
  
  async getPropertyKeys(device) {
    return ['brightness', 'connected', 'on'];
  },

  async synchronize() {
    const devices = await Device.findByProvider('shelly');

    for (const device of devices) {
      const shellyDevice = new DeviceClient(device.meta.endpoint, config.shelly.user, config.shelly.password);
      const newName = await shellyDevice.getDeviceName();

      if (newName !== null) {
        device.name = newName;
      }

      await device.save();
    }
  }
});