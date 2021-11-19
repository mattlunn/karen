import Light from './light';
import Thermostat from './thermostat';
import BasicDevice from './basic-device';

export default class Device {
  static create(device) {
    switch (device.type) {
      case 'thermostat':
        return new Thermostat(device);
      case 'light':
        return new Light(device);
      default:
        return new BasicDevice(device);
    }
  }
}