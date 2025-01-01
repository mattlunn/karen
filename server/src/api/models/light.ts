import { Device } from '../../models';

export default class Light {
  #data: Device;

  __typename = 'Light';

  constructor(data: Device) {
    this.#data = data;
  }

  async isOn(): Promise<boolean> {
    return await this.#data.getProperty('on') ?? false;
  }

  brightness(): Promise<number> {
    return this.#data.getProperty('brightness');
  }
}