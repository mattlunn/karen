import { Device, Event } from '../';

export { LightCapability } from './light';
export { LockCapability } from './lock';
export { SpeakerCapability } from './speaker';
export * from './capabilities.gen'

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
};