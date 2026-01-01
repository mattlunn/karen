export type CapabilityApiResponse = {
  type: 'LIGHT';
  isOnHistory: HistoryDetailsApiResponse<BooleanEventApiResponse>;
  brightnessHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
} | {
  type: 'THERMOSTAT';
  currentTemperatureHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  targetTemperatureHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  powerHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  isOnHistory: HistoryDetailsApiResponse<BooleanEventApiResponse>;
} | {
  type: 'HUMIDITY_SENSOR';
  humidityHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
} | {
  type: 'TEMPERATURE_SENSOR';
  currentTemperatureHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
} | {
  type: 'LIGHT_SENSOR';
  illuminanceHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
} | {
  type: 'MOTION_SENSOR';
  hasMotionHistory: HistoryDetailsApiResponse<BooleanEventApiResponse>;
} | {
  type: 'HEAT_PUMP',
  dHWTemperatureHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  outsideTemperatureHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  yieldHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  powerHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  dailyCoPHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  returnTemperatureHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  actualFlowTemperatureHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  systemPressureHistory: HistoryDetailsApiResponse<NumericEventApiResponse>;
  modeHistory: HistoryDetailsApiResponse<EnumEventApiResponse>;
  dHWCoP: number;
  heatingCoP: number;
  totalDailyYield: number;
} | {
  type: null
};

export type BooleanEventApiResponse = {
  start: string;
  end: string | null;
  value: true;
}

export type NumericEventApiResponse = {
  start: string;
  end: string | null;
  value: number;
}

export type EnumEventApiResponse = {
  start: string;
  end: string | null;
  value: string;
}

export type HistoryDetailsApiResponse<T> = {
  since: string,
  until: string,
  history: T[]
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