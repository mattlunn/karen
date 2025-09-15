import { Device } from '../device';

export { LightCapability } from './light';
export { LockCapability } from './lock';
export { SpeakerCapability } from './speaker';
export * from './index.gen'

export type ProviderLightCapability = {
  setBrightness(device: Device, brightness: number): Promise<void>;
  setIsOn(device: Device, isOn: boolean): Promise<void>;
}

export type ProviderLockCapability = {
  setIsLocked(device: Device, isLocked: boolean): Promise<void>;
}

export type ProviderThermostatCapability = {
  setTargetTemperature(device: Device, target: number | null): Promise<void>
  setIsOn(device: Device, isOn: boolean): Promise<void>
}

export type ProviderSwitchCapability = {
  setIsOn(device: Device, isOn: boolean): Promise<void>;
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
};

export type Capability = 'LIGHT'
  | 'THERMOSTAT' 
  | 'HUMIDITY_SENSOR' 
  | 'TEMPERATURE_SENSOR' 
  | 'MOTION_SENSOR' 
  | 'LIGHT_SENSOR' 
  | 'CAMERA' 
  | 'SPEAKER' 
  | 'SWITCH' 
  | 'HEAT_PUMP'
  | 'LOCK'
  | 'BATTERY_LEVEL_INDICATOR'
  | 'BATTERY_LOW_INDICATOR';