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

export interface Device {
  type: 'light' | 'thermostat',
  device: Light | Thermostat
}

export type DeviceStatus = 'OK' | 'OFFLINE';
export type AlarmMode = 'OFF' | 'AWAY' | 'NIGHT';
