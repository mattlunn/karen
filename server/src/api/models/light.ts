import { Device } from '../../models';

export default class Light {
  #data: Device;

  __typename = 'Light';

  constructor(data: Device) {
    this.#data = data;
  }

  isOn(): Promise<boolean> {
    return this.#data.getLightCapability().getIsOn();
  }

  brightness(): Promise<number> {
    return this.#data.getLightCapability().getBrightness();
  }
}