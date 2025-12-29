export type CapabilityApiResponse = {
  type: 'LIGHT';
  brightness: number;
  isOn: boolean;
} | {
  type: 'THERMOSTAT';
  currentTemperature: number;
  targetTemperature: number;
  power: number;
  isOn: boolean;
} | {
  type: 'HUMIDITY_SENSOR';
  humidity: number;
} | {
  type: 'TEMPERATURE_SENSOR';
  currentTemperature: number;
};

export type DeviceApiResponse = {
  device: {
    capabilities: CapabilityApiResponse[];
    id: number;
    name: string;
    type: string;
    provider: string;
    providerId: string;
  }
}