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