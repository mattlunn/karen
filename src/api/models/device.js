import Light from './light';
import Thermostat from './thermostat';
import BasicDevice from './basic-device';

export default class Device {
  static create(device) {
    switch (device.type) {
      case 'thermostat':
        return {
          type: 'thermostat',
          device: new Thermostat(device)
        };
      case 'light':
        return {
          type: 'light',
          device: new Light(device)
        };
      default:
        return {
          type: device.type,
          device: new BasicDevice(device)
        };
    }
  }
}