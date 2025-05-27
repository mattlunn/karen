import { Device } from '../models';
import { booleanProperty } from './helpers';

@booleanProperty('IsBatteryLow', { dbName: 'battery_low' })
export default class BatteryLowIndicatorCapability {
  device: Device;

  constructor(device: Device) {
    this.device = device;
  }
}