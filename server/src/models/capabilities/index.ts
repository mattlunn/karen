import { Device } from '../device';

export { LightCapability } from './light';
export { BatteryLevelIndicatorCapability } from './battery_level_indicator';
export { BatteryLowIndicatorCapability } from './battery_low_indicator';
export { HumiditySensorCapability } from './humidity_sensor';
export { LightSensorCapability } from './light_sensor';
export { LockCapability } from './lock';
export { MotionSensorCapability } from './motion_sensor';
export { TemperatureSensorCapability } from './temperature_sensor';
export { ThermostatCapability } from './thermostat';
export { SwitchCapability } from './switch';
export { HeatPumpCapability } from './heat_pump';
export { SpeakerCapability } from './speaker';

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