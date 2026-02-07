import { Device } from '../';
import { ProviderThermostatCapabilityBase } from './capabilities.gen';

export { LightCapability } from './light';
export { LockCapability } from './lock';
export { SpeakerCapability } from './speaker';
export { ThermostatCapability } from './thermostat';
export * from './capabilities.gen';

export type ScheduledChange = {
  timestamp: Date;
  temperature: number;
};

export interface ProviderThermostatCapability extends ProviderThermostatCapabilityBase {
  getNextScheduledChange(device: Device): Promise<ScheduledChange | null>;
  getScheduledTemperatureAtTime(device: Device, timestamp: Date): Promise<number | null>;
}

export type ProviderSpeakerCapability = {
  emitSound(device: Device, sound: string | string[], ttlInSeconds?: number): Promise<void>;
}

export enum HeatPumpMode {
  UNKNOWN = 0,
  STANDBY = 1,
  HEATING = 2,
  DHW = 3,
  DEICING = 4,
  FROST_PROTECTION = 5
}