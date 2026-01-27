import { Device } from '../../models';
import DeviceClient from './client/device';
import config from '../../config';
import logger from '../../logger';
import model from 'sequelize/lib/model';

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
      try {
        const shellyDevice = DeviceClient.forGeneration(device.meta.generation as number, device.meta.endpoint as string, config.shelly.user, config.shelly.password);
        const newName = await shellyDevice.getDeviceName();

        if (newName !== null) {
          device.name = newName;
        }
        
        // TODO: Eventually move this to "on create" (right now we also have to correct existing devices)
        if (device.getCapabilities().includes('LIGHT')) {
          const brightnessHistory = await device.getLightCapability().getBrightnessHistory({ until: new Date(), limit : 1 });

          if (brightnessHistory.length === 0) {
            await device.getLightCapability().setBrightnessState(100, device.createdAt);

            logger.info(`Initialized brightness for Shelly light device ${device.id}`);
          }
        }

        device.manufacturer = 'Shelly';
        device.model = await shellyDevice.getModel() || 'Unknown';

        await device.save();
      } catch (e) {
        logger.error(e, `Failed to synchronize Shelly device ${device.id} (${device.name})`);
      }
    }
  }
});