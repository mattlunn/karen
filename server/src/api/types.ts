// Device API response - current status values only (no history)
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
} | {
  type: 'LIGHT_SENSOR';
  illuminance: number;
} | {
  type: 'MOTION_SENSOR';
  hasMotion: boolean;
} | {
  type: 'HEAT_PUMP';
  dHWCoP: number;
  heatingCoP: number;
  totalDailyYield: number;
  outsideTemperature: number;
  dHWTemperature: number;
  actualFlowTemperature: number;
  returnTemperature: number;
  systemPressure: number;
} | {
  type: null;
};

// History API response types
export type BooleanEventApiResponse = {
  start: string;
  end: string | null;
  value: true;
};

export type NumericEventApiResponse = {
  start: string;
  end: string | null;
  value: number;
};

export type EnumEventApiResponse = {
  start: string;
  end: string | null;
  value: string;
};

export type HistoryDetailsApiResponse<T> = {
  since: string;
  until: string;
  history: T[];
};

export type DeviceApiResponse = {
  device: {
    capabilities: CapabilityApiResponse[];
    id: number;
    name: string;
    type: string;
    provider: string;
    providerId: string;
  };
};
