import { Capability } from '.';
import { Device } from '../models';
import { numericProperty } from './helpers';

export type HumiditySensorCapabilityProviderHandlers = never;

@numericProperty('Humidity', { dbName: 'humidity' })
export class HumiditySensorCapability extends Capability<HumiditySensorCapability, HumiditySensorCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, undefined);
  }

  declare getHumidity: () => Promise<number>;
  declare setHumidityState: (humidity: number) => Promise<void>;
}