import { Device } from '../device';
import { getBooleanProperty, setBooleanProperty } from './helpers/boolean';

export class MotionSensorCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;
  
  getHasMotion(): Promise<boolean> {
    return getBooleanProperty(this.#device, 'motion');
  }

  setMotionState(hasMotion: boolean): Promise<void> {
    return setBooleanProperty(this.#device, 'motion', hasMotion);
  }
}