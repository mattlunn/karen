import { Capability } from '.';
import { Device } from '../models';
import { numericProperty } from './helpers';

export type TemperatureSensorCapabilityProviderHandlers = never;

@numericProperty('Temperature', { dbName: 'temperature' })
export class TemperatureSensorCapability extends Capability<TemperatureSensorCapability, TemperatureSensorCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, undefined);
  }

  declare getTemperature: () => Promise<number>;
  declare setTemperatureState: (temperature: number) => Promise<void>;
}