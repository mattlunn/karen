import { Device } from '../../models';
import DeviceClient from './client/device';
import config from '../../config';

Device.registerProvider('shelly', {
  getCapabilities(device) {
    switch (device.meta.generation) {
      case 1:
      case 2:
        return ['LIGHT'];
      case 3:
        return ['SWITCH'];
      default:
        throw new Error(`Cannot infer capabilities for device ${device.id}`);
    }
  },

  provideLightCapability() {
    return {
      setBrightness(device: Device, brightness: number) {
        const shellyDevice = DeviceClient.forGeneration(device.meta.generation as number, device.meta.endpoint as string, config.shelly.user, config.shelly.password);

        return shellyDevice.setBrightness(brightness);
      },

      setIsOn(device: Device, isOn: boolean) {
        const shellyDevice = DeviceClient.forGeneration(device.meta.generation as number, device.meta.endpoint as string, config.shelly.user, config.shelly.password);

        return shellyDevice.setIsOn(isOn);
      },
    };
  },

  provideSwitchCapability() {
    return {
      async setIsOn(device: Device, isOn: boolean) {
        const shellyDevice = DeviceClient.forGeneration(device.meta.generation as number, device.meta.endpoint as string, config.shelly.user, config.shelly.password);

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