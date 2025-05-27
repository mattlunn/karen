import { Device } from '../models';
import { getter as numberGetter, setter as numberSetter } from './helpers/numeric_property';

export class LightSensorCapability {
  #device: Device;

  constructor(device: Device) {
    this.#device = device;
  }

  async getIlluminance(): Promise<number> {
    return numberGetter(this.#device, 'illuminance');
  }

  async setIlluminanceState(illuminance: number): Promise<void> {
    return numberSetter(this.#device, 'illuminance', illuminance, new Date());
  }
}