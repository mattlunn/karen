import { Device } from '../models';
import { getter as numericGetter, setter as numericSetter } from './helpers/numeric_property';

export class TemperatureSensorCapability {
  #device: Device;

  constructor(device: Device) {
    this.#device = device;
  }

  async getTemperature(): Promise<number> {
    return numericGetter(this.#device, 'temperature');
  }

  async setTemperatureState(temperature: number): Promise<void> {
    return numericSetter(this.#device, 'temperature', temperature, new Date());
  }
}