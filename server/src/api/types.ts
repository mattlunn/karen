// Device API response - current status values with timestamps
export type CapabilityApiResponse = {
  type: 'LIGHT';
  brightness: NumericEventApiResponse;
  isOn: BooleanEventApiResponse;
} | {
  type: 'THERMOSTAT';
  currentTemperature: NumericEventApiResponse;
  targetTemperature: NumericEventApiResponse;
  power: NumericEventApiResponse;
  isOn: BooleanEventApiResponse;
} | {
  type: 'HUMIDITY_SENSOR';
  humidity: NumericEventApiResponse;
} | {
  type: 'TEMPERATURE_SENSOR';
  currentTemperature: NumericEventApiResponse;
} | {
  type: 'LIGHT_SENSOR';
  illuminance: NumericEventApiResponse;
} | {
  type: 'MOTION_SENSOR';
  hasMotion: BooleanEventApiResponse;
} | {
  type: 'HEAT_PUMP';
  dHWCoP: NumericEventApiResponse;
  heatingCoP: NumericEventApiResponse;
  totalDailyYield: NumericEventApiResponse;
  outsideTemperature: NumericEventApiResponse;
  dHWTemperature: NumericEventApiResponse;
  actualFlowTemperature: NumericEventApiResponse;
  returnTemperature: NumericEventApiResponse;
  systemPressure: NumericEventApiResponse;
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

// History API response types
export type HistoryLineApiResponse = {
  data: HistoryDetailsApiResponse<NumericEventApiResponse>;
  label: string;
  yAxisID?: string;
};

export type HistoryModeDetailApiResponse = {
  value: string | true;
  label: string;
  fillColor?: string;
};

export type HistoryModesApiResponse = {
  data: HistoryDetailsApiResponse<EnumEventApiResponse | BooleanEventApiResponse>;
  details: HistoryModeDetailApiResponse[];
};

export type HistoryBarApiResponse = {
  data: HistoryDetailsApiResponse<NumericEventApiResponse>;
  label: string;
  yAxisID?: string;
};

export type HistoryApiResponse = {
  lines: HistoryLineApiResponse[];
  modes?: HistoryModesApiResponse;
  bar?: HistoryBarApiResponse;
};

// Timeline API response types
export type TimelineEventApiResponse = {
  type: 'light-on' | 'light-off' | 'motion-start' | 'motion-end' | 'heatpump-mode';
  timestamp: string;
  value?: string;
};

export type TimelineApiResponse = {
  since: string;
  until: string;
  events: TimelineEventApiResponse[];
};
