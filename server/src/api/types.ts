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
  type: 'HEAT_PUMP',
  dHWTemperatureHistory: NumericEventApiResponse[];
  outsideTemperatureHistory: NumericEventApiResponse[];
  yieldHistory: NumericEventApiResponse[];
  powerHistory: NumericEventApiResponse[];
  returnTemperatureHistory: NumericEventApiResponse[];
  actualFlowTemperatureHistory: NumericEventApiResponse[];
  systemPressureHistory: NumericEventApiResponse[];
  modeHistory: EnumEventApiResponse[];
  dHWCoP: number;
  heatingCoP: number;
  totalDailyYield: number;
} | {
  type: null
};

/*
dHWCoP: heatPump.getDHWCoP(),
heatingCoP: heatPump.getHeatingCoP(),
dHWTemperatureHistory: mapNumericHistoryToResponse((hs) => heatPump.getDHWCoPHistory(hs), historySelector),
powerHistory: mapNumericHistoryToResponse((hs) => heatPump.getCurrentPowerHistory(hs), historySelector),
yieldHistory: mapNumericHistoryToResponse((hs) => heatPump.getCurrentYieldHistory(hs), historySelector),
totalDailyYield: heatPump.getDailyConsumedEnergy(),
outsideTemperatureHistory: mapNumericHistoryToResponse((hs) => heatPump.getOutsideTemperatureHistory(hs), historySelector),
*/

export type BooleanEventApiResponse = {
  start: string;
  end: string | null;
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

export type HistoryDetailsApiResponse = {
  since: string,
  until: string
}

export type DeviceApiResponse = {
  device: {
    capabilities: CapabilityApiResponse[];
    id: number;
    name: string;
    type: string;
    provider: string;
    providerId: string;
  },

  history: HistoryDetailsApiResponse
}