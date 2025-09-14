import { Device } from '../device';
import { getNumericProperty, setNumericProperty } from './helpers/number';

export class TemperatureSensorCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;

  getCurrentTemperature(): Promise<number> {
    return getNumericProperty(this.#device, 'temperature');
  }

  setCurrentTemperatureState(temperature: number): Promise<void> {
    return setNumericProperty(this.#device, 'temperature', temperature);
  }
}