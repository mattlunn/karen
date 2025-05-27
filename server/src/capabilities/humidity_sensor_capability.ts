import { Device } from '../models';
import { getter as numberGetter, setter as numberSetter } from './helpers/numeric_property';

export class HumiditySensorCapability {
  #device: Device;

  constructor(device: Device) {
    this.#device = device;
  }

  async getHumidity(): Promise<number> {
    return numberGetter(this.#device, 'humidity');
  }

  async setHumidityState(humidity: number): Promise<void> {
    return numberSetter(this.#device, 'humidity', humidity, new Date());
  }
}