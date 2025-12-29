export type CapabilityApiResponse = {
  type: 'LIGHT';
  isOnHistory: BooleanEventApiResponse[];
  brightnessHistory: NumericEventApiResponse[];
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
} | {
  type: 'LIGHT_SENSOR';
  illuminance: number;
} | {
  type: 'MOTION_SENSOR';
  hasMotion: boolean;
} | {
  type: null
};

export type BooleanEventApiResponse = {
  start: string;
  end: string | null;
}

export type NumericEventApiResponse = {
  start: string;
  end: string | null;
  value: number;
}

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