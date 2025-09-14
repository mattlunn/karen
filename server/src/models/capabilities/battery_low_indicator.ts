import { Device } from '../device';
import { getBooleanProperty, setBooleanProperty } from './helpers/boolean';

export class BatteryLowIndicatorCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;

  getIsBatteryLow(): Promise<boolean> {
    return getBooleanProperty(this.#device, 'battery_low');
  }

  setIsBatteryLowState(batteryLevel: boolean): Promise<void> {
    return setBooleanProperty(this.#device, 'battery_low', batteryLevel);
  }
}