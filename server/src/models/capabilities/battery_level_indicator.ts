import { Device } from '../device';
import { getNumericProperty, setNumericProperty } from './helpers/number';

export class BatteryLevelIndicatorCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;

  getBatteryPercentage(): Promise<number> {
    return getNumericProperty(this.#device, 'battery_percentage');
  }

  setBatteryPercentageState(batteryLevel: number): Promise<void> {
    return setNumericProperty(this.#device, 'battery_percentage', batteryLevel);
  }
}