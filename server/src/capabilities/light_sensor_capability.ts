import { Capability } from '.';
import { Device } from '../models';
import { numericProperty } from './helpers';

@numericProperty('Illuminance', { dbName: 'illumninance' })
export class LightSensorCapability implements Capability<LightSensorCapability, 'getIlluminance'> {
  device: Device;
  handlers: Pick<LightSensorCapability, 'getIlluminance'>;

  constructor(device: Device) {
    this.device = device;
    this.handlers = { getIlluminance: () => Promise.resolve(null) };
  }
}