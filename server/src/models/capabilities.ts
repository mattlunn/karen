export type LightCapability = {
  getIsOn(): Promise<boolean>;
  getBrightness(): Promise<number>;
  setBrightness(brightness: number): Promise<void>;
  setIsOn(isOn: boolean): Promise<void>;
}

export type ThermostatCapability = {
  getPower(): Promise<number>;
  getCurrentTemperature(): Promise<number>;
  getTargetTemperature(): Promise<number>;
  getIsHeating(): Promise<boolean>
  setTargetTemperature(target: number | null): Promise<void>
  setIsOn(isOn: boolean): Promise<void>
}

export type HumiditySensorCapability = {
  getHumidity(): Promise<number>;
}

export type LightSensorCapability = {
  getIlluminance(): Promise<number>;
}

export type SwitchCapability = {
  getIsOn(): Promise<boolean>;
  setIsOn(isOn: boolean): Promise<void>;
}

export enum HeatPumpMode {
  UNKNOWN = 0,
  STANDBY = 1,
  HEATING = 2,
  DHW = 3, 
  DEICING = 4,
  FROST_PROTECTION = 5
};

export type HeatPumpCapability = {
  getDailyConsumedEnergy(): Promise<number>;
  getMode(): Promise<HeatPumpMode>;
  getCompressorModulation(): Promise<number>;
  getDHWTemperature(): Promise<number>;
  getHeatingCoP(): Promise<number>;
}

export type TemperatureSensorCapability = {
  getCurrentTemperature(): Promise<number>;
}

export type MotionSensorCapability = {
  getHasMotion(): Promise<boolean>;
}

export type BatteryLevelIndicatorCapability = {
  getBatteryPercentage(): Promise<number>;
}

export type BatteryLowIndicatorCapability = {
  getIsBatteryLow(): Promise<boolean>;
}

export type LockCapability = {
  getIsLocked(): Promise<boolean>;
  setIsLocked(isLocked: boolean): Promise<void>;
}

export type SpeakerCapability = {
  emitSound(sound: string, ttlInSeconds?: number): Promise<void>;
  emitSound(sound: string[], ttlInSeconds?: number): Promise<void>;
}

export type CameraCapability = {}

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