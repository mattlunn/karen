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

export type TemperatureSensorCapability = {
  getCurrentTemperature(): Promise<number>;
}

export type MotionSensorCapability = {
  getHasMotion(): Promise<boolean>;
}

export type SpeakerCapability = {
  emitSound(sound: string, ttlInSeconds?: number): Promise<void>;
  emitSound(sound: string[], ttlInSeconds?: number): Promise<void>;
}

export type CameraCapability = {}

export type Capability = 'LIGHT' | 'THERMOSTAT' | 'HUMIDITY_SENSOR' | 'TEMPERATURE_SENSOR' | 'MOTION_SENSOR' | 'LIGHT_SENSOR' | 'CAMERA' | 'SPEAKER';