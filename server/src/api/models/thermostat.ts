import { Device } from '../../models';

export default class Thermostat {
  #device: Device;

  __typename = 'Thermostat';

  constructor(device: Device) {
    this.#device = device;
  }

  targetTemperature(): Promise<number> {
    return this.#device.getProperty<number>('target');
  }

  currentTemperature(): Promise<number> {
    return this.#device.getProperty<number>('temperature');
  }

  isHeating(): Promise<boolean> {
    return this.#device.getProperty<boolean>('heating');
  }

  humidity(): Promise<number> {
    return this.#device.getProperty<number>('humidity');
  }

  power(): Promise<number> {
    return this.#device.getProperty<number>('power');
  }
}