import { Device } from '../models';
import { booleanProperty } from './helpers';

@booleanProperty('HasMotion', { dbName: 'motion' })
export class MotionSensorCapability {
  device: Device;

  constructor(device: Device) {
    this.device = device;
  }
}