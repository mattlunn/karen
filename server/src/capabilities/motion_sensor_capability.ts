import { Device } from '../models';
import { getter as booleanGetter, setter as booleanSetter } from './helpers/boolean_property';

export class MotionSensorCapability {
  #device: Device;

  constructor(device: Device) {
    this.#device = device;
  }

  async getHasMotion(): Promise<boolean> {
    return booleanGetter(this.#device, 'motion');
  }

  async setHasMotionState(hasMotion: boolean): Promise<void> {
    return booleanSetter(this.#device, 'motion', hasMotion, new Date());
  }
}