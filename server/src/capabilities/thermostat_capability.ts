import { Capability } from '.';
import { Device } from '../models';
import { numericProperty, booleanProperty } from './helpers';

export type ThermostatCapabilityProviderHandlers = 'setTargetTemperature' | 'setIsOn';

@numericProperty('CurrentTemperature', { dbName: 'temperature' })
@numericProperty('TargetTemperature', { dbName: 'target', writeable: true })
@numericProperty('Power', { dbName: 'power' })
@booleanProperty('IsOn', { dbName: 'heating', writeable: true })
export class ThermostatCapability extends Capability<ThermostatCapability, ThermostatCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, Device.getProviderOrThrow(device.provider)!.getThermostatCapability);
  }

  declare setTargetTemperature: (targetTemperature: number, signal?: AbortSignal) => Promise<void>;
  declare getTargetTemperature: () => Promise<number>;
  declare setTargetTemperatureState: (targetTemperature: number) => Promise<void>;

  declare setIsOn: (isOn: boolean, signal?: AbortSignal) => Promise<void>;
  declare getIsOn: () => Promise<boolean>;
  declare setIsOnState: (isOn: boolean) => Promise<void>;

  declare getCurrentTemperature: () => Promise<number>;
  declare setCurrentTemperatureState: (currentTemperature: number) => Promise<void>;

  declare getPower: () => Promise<number>;
  declare setPowerState: (power: number) => Promise<void>;
}