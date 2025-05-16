import { Device } from '../../models';

export default class Lock {
  #data: Device;

  __typename = 'Lock';

  constructor(data: Device) {
    this.#data = data;
  }

  isLocked(): Promise<boolean> {
    return this.#data.getLockCapability().getIsLocked();
  }
}