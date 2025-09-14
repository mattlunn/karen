import { Device } from '../device';
import { getNumericProperty, setNumericProperty } from './helpers/number';

export class LightSensorCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;

  getIlluminance(): Promise<number> {
    return getNumericProperty(this.#device, 'illuminance');
  }

  setIlluminanceState(illuminance: number): Promise<void> {
    return setNumericProperty(this.#device, 'illuminance', illuminance);
  }
}