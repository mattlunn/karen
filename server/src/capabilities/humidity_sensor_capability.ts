import { Device } from '../models';
import { numericProperty } from './helpers';

@numericProperty('Humidity', { dbName: 'humidity' })
export class HumiditySensorCapability {
  device: Device;

  constructor(device: Device) {
    this.device = device;
  }
}