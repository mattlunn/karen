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

// ============================================================================
// REST API Types - Single source of truth for all REST endpoints
// ============================================================================

// Common types
export type DeviceStatus = 'OK' | 'OFFLINE';
export type AlarmMode = 'OFF' | 'AWAY' | 'NIGHT';
export type UserStatus = 'HOME' | 'AWAY';
export type CentralHeatingMode = 'ON' | 'OFF' | 'SETBACK';
export type DHWHeatingMode = 'ON' | 'OFF';

// Capability data types (discriminated union for type safety)
export type RestCapabilityData = {
  type: 'CAMERA';
  snapshotUrl: string;
} | {
  type: 'LIGHT_SENSOR';
  illuminance: number;
} | {
  type: 'HUMIDITY_SENSOR';
  humidity: number;
} | {
  type: 'LIGHT';
  isOn: boolean;
  brightness: number | null;
} | {
  type: 'HEAT_PUMP';
  mode: string;
  dailyConsumedEnergy: number;
  heatingCoP: number;
  compressorModulation: number;
  dhwTemperature: number;
} | {
  type: 'LOCK';
  isLocked: boolean;
} | {
  type: 'MOTION_SENSOR';
  motionDetected: boolean;
} | {
  type: 'TEMPERATURE_SENSOR';
  currentTemperature: number;
} | {
  type: 'THERMOSTAT';
  targetTemperature: number;
  currentTemperature: number;
  isHeating: boolean;
  power: number;
} | {
  type: 'SPEAKER';
} | {
  type: 'SWITCH';
  isOn: boolean;
} | {
  type: 'BATTERY_LEVEL_INDICATOR';
  batteryPercentage: number;
} | {
  type: 'BATTERY_LOW_INDICATOR';
  isLow: boolean;
} | {
  type: string; // Fallback for unknown capability types
};

// /api/devices endpoint
export interface HomeRoom {
  id: number;
  name: string;
  displayIconName: string | null;
  displayWeight: number | null;
}

export interface HomeCamera {
  id: number;
  name: string;
  snapshotUrl: string;
}

export interface RestDeviceResponse {
  id: number;
  name: string;
  roomId: number | null;
  status: DeviceStatus;
  capabilities: RestCapabilityData[];
}

export interface DevicesApiResponse {
  rooms: HomeRoom[];
  devices: RestDeviceResponse[];
}

// /api/device/:id/light endpoint
export interface LightUpdateRequest {
  isOn?: boolean;
  brightness?: number;
}

export interface LightResponse {
  id: number;
  name: string;
  status: DeviceStatus;
  light: {
    isOn: boolean;
    brightness: number | null;
  };
}

// /api/device/:id/lock endpoint
export interface LockUpdateRequest {
  isLocked: boolean;
}

export interface LockResponse {
  id: number;
  name: string;
  status: DeviceStatus;
  lock: {
    isLocked: boolean;
  };
}

// /api/device/:id/thermostat endpoint
export interface ThermostatUpdateRequest {
  targetTemperature: number;
}

export interface ThermostatResponse {
  id: number;
  name: string;
  status: DeviceStatus;
  thermostat: {
    targetTemperature: number;
    currentTemperature: number;
    isHeating: boolean;
    power: number;
  };
}

// /api/sidebar endpoint
export interface SidebarUser {
  id: string;
  avatar: string;
  status: UserStatus;
  since: number;
  until: number | null;
}

export interface SidebarThermostat {
  id: number;
  targetTemperature: number;
  setbackTemperature: number;
}

export interface SidebarApiResponse {
  users: SidebarUser[];
  security: {
    alarmMode: AlarmMode;
  };
  heating: {
    dhwHeatingMode: DHWHeatingMode;
    thermostats: SidebarThermostat[];
  };
}

// /api/security/alarm endpoint
export interface AlarmStatusResponse {
  alarmMode: AlarmMode;
}

export interface AlarmUpdateRequest {
  mode: AlarmMode;
}

// /api/heating endpoints
export interface CentralHeatingUpdateRequest {
  mode: CentralHeatingMode;
}

export interface CentralHeatingResponse {
  mode: CentralHeatingMode;
  thermostats: {
    id: number;
    targetTemperature: number;
    setbackTemperature: number;
    isHeating: boolean;
  }[];
}

export interface DHWHeatingUpdateRequest {
  mode: DHWHeatingMode;
}

export interface DHWHeatingResponse {
  dhwHeatingMode: DHWHeatingMode;
}
