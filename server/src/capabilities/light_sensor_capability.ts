import { Capability } from '.';
import { Device } from '../models';
import { numericProperty } from './helpers';

export type LightSensorCapabilityProviderHandlers = never;

@numericProperty('Illuminance', { dbName: 'illumninance' })
export class LightSensorCapability extends Capability<LightSensorCapability, LightSensorCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, undefined);
  }

  declare getIlluminance: () => Promise<number>;
  declare setIluminanceState: (number: number) => Promise<void>;
}