import { Device } from '../device';
import { getNumericProperty, setNumericProperty } from './helpers/number';

export class HumiditySensorCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;

  getHumidity(): Promise<number> {
    return getNumericProperty(this.#device, 'humidity');
  }

  setHumidityState(humidity: number): Promise<void> {
    return setNumericProperty(this.#device, 'humidity', humidity);
  }
}