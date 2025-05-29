import { Capability } from '.';
import { Device } from '../models';
import { booleanProperty } from './helpers';

export type MotionSensorProviderHandlers = never;

@booleanProperty('HasMotion', { dbName: 'motion' })
export class MotionSensorCapability extends Capability<MotionSensorCapability, MotionSensorProviderHandlers> {
  constructor(device: Device) {
    super(device, undefined);
  }

  declare getHasMotion: () => Promise<boolean>;
  declare setHasMotionState: (hasMotion: boolean) => Promise<void>;
}