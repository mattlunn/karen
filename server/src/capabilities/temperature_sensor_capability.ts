import { Device } from '../models';
import { numericProperty } from './helpers';

@numericProperty('Temperature', { dbName: 'temperature' })
export class TemperatureSensorCapability {
  device: Device;

  constructor(device: Device) {
    this.device = device;
  }
}