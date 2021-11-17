export interface Light {
  id: string;
  name: string;
  isOn: boolean;
  brightness: number;
  status: DeviceStatus;
}

export interface Thermostat {
  id: string;
  name: string;
  targetTemperature: number;
  currentTemperature: number;
  humidity: number;
  power: number;
  isHeating: boolean;
  status: DeviceStatus;
}

export interface BasicDevice {
  id: string;
  name: string;
  status: DeviceStatus;
}

export type Device = {
  type: 'light'
  device: Light 
} | { 
  type: 'thermostat'
  device: Thermostat
} | {
  type: 'alexa'
  device: BasicDevice
};

export type DeviceStatus = 'OK' | 'OFFLINE';
export type AlarmMode = 'OFF' | 'AWAY' | 'NIGHT';
