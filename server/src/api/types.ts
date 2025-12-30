export type CapabilityApiResponse = {
  type: 'LIGHT';
  isOnHistory: BooleanEventApiResponse[];
  brightnessHistory: NumericEventApiResponse[];
} | {
  type: 'THERMOSTAT';
  currentTemperatureHistory: NumericEventApiResponse[];
  targetTemperatureHistory: NumericEventApiResponse[];
  powerHistory: NumericEventApiResponse[];
  isOnHistory: BooleanEventApiResponse[];
} | {
  type: 'HUMIDITY_SENSOR';
  humidityHistory: NumericEventApiResponse[];
} | {
  type: 'TEMPERATURE_SENSOR';
  currentTemperatureHistory: NumericEventApiResponse[];
} | {
  type: 'LIGHT_SENSOR';
  illuminanceHistory: NumericEventApiResponse[];
} | {
  type: 'MOTION_SENSOR';
  hasMotionHistory: BooleanEventApiResponse[];
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