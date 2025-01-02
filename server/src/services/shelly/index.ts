import { Device } from '../../models';
import DeviceClient from './client/device';
import config from '../../config';

Device.registerProvider('shelly', {
  getCapabilities(device) {
    return ['LIGHT'];
  },

  getLightCapability(device) {
    const shellyDevice = new DeviceClient(device.meta.endpoint, config.shelly.user, config.shelly.password);

    return {
      async getBrightness() {
        return (await device.getLatestEvent('brightness'))?.value ?? 100;
      },

      async getIsOn() {
        const latestEvent = await device.getLatestEvent('on');
        return !!(latestEvent && !latestEvent.end);
      },

      setBrightness(brightness) {
        return shellyDevice.setBrightness(brightness);
      },

      setIsOn(isOn) {
        return shellyDevice.setIsOn(isOn);
      },
    };
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