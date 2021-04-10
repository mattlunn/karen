export interface Light {
  id: string;
  name: string;
  isOn: boolean;
  brightness: number;
}

export interface Thermostat {
  id: string;
  name: string;
  targetTemperature: number;
  currentTemperature: number;
  humidity: number;
  power: number;
  isHeating: boolean;
}

export interface Device {
  type: 'light' | 'thermostat',
  device: Light | Thermostat
}