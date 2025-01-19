import { Device } from '../../models';
import DeviceClient from './client/device';
import config from '../../config';

Device.registerProvider('shelly', {
  getCapabilities(device) {
    switch (device.meta.generation) {
      case 1:
        return ['LIGHT'];
      case 3:
        return ['SWITCH'];
      default:
        throw new Error(`Cannot infer capabilities for device ${device.id}`);
    }
  },

  getLightCapability(device) {
    const shellyDevice = DeviceClient.forGeneration(device.meta.generation as number, device.meta.endpoint as string, config.shelly.user, config.shelly.password);

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

  getSwitchCapability(device) {
    const shellyDevice = DeviceClient.forGeneration(device.meta.generation as number, device.meta.endpoint as string, config.shelly.user, config.shelly.password);

    return {
      async getIsOn() {
        const latestEvent = await device.getLatestEvent('on');
        return !!(latestEvent && !latestEvent.end);
      },

      async setIsOn(isOn) {
        return await shellyDevice.setIsOn(isOn);
      },
    };
  },

  async synchronize() {
    const devices = await Device.findByProvider('shelly');

    for (const device of devices) {
      const shellyDevice = DeviceClient.forGeneration(device.meta.generation as number, device.meta.endpoint as string, config.shelly.user, config.shelly.password);
      const newName = await shellyDevice.getDeviceName();

      if (newName !== null) {
        device.name = newName;
      }

      await device.save();
    }
  }
});