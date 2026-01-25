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
  isHeating: BooleanEventApiResponse;
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
  mode: EnumEventApiResponse;
  dailyConsumedEnergy: NumericEventApiResponse;
  heatingCoP: NumericEventApiResponse;
  compressorModulation: NumericEventApiResponse;
  dhwTemperature: NumericEventApiResponse;
  dHWCoP: NumericEventApiResponse;
  outsideTemperature: NumericEventApiResponse;
  actualFlowTemperature: NumericEventApiResponse;
  returnTemperature: NumericEventApiResponse;
  systemPressure: NumericEventApiResponse;
} | {
  type: 'CAMERA';
  snapshotUrl: EnumEventApiResponse;
} | {
  type: 'LOCK';
  isLocked: BooleanEventApiResponse;
} | {
  type: 'SPEAKER';
} | {
  type: 'SWITCH';
  isOn: BooleanEventApiResponse;
} | {
  type: 'BATTERY_LEVEL_INDICATOR';
  batteryPercentage: NumericEventApiResponse;
} | {
  type: 'BATTERY_LOW_INDICATOR';
  isLow: BooleanEventApiResponse;
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
  device: RestDeviceResponse;
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

// Device Timeline API response types (/api/device/:id/timeline)
export type DeviceTimelineEventApiResponse = {
  type: 'light-on' | 'light-off' | 'motion-start' | 'motion-end' | 'heatpump-mode';
  timestamp: string;
  value?: string;
};

export type DeviceTimelineApiResponse = {
  since: string;
  until: string;
  events: DeviceTimelineEventApiResponse[];
};

// Common types
export type DeviceStatus = 'OK' | 'OFFLINE';
export type AlarmMode = 'OFF' | 'AWAY' | 'NIGHT';
export type UserStatus = 'HOME' | 'AWAY';
export type CentralHeatingMode = 'ON' | 'OFF' | 'SETBACK';
export type DHWHeatingMode = 'ON' | 'OFF';

// /api/devices endpoint
export interface HomeRoom {
  id: number;
  name: string;
  displayIconName: string | null;
  displayWeight: number | null;
}

export interface RestDeviceResponse {
  id: number;
  name: string;
  type: string;
  provider: string;
  providerId: string;
  roomId: number | null;
  status: DeviceStatus;
  capabilities: CapabilityApiResponse[];
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

// /api/device/:id/lock endpoint
export interface LockUpdateRequest {
  isLocked: boolean;
}

// /api/device/:id/thermostat endpoint
export interface ThermostatUpdateRequest {
  targetTemperature: number;
}

// /api/security endpoint
export interface AlarmStatusResponse {
  alarmMode: AlarmMode;
}

export interface AlarmUpdateRequest {
  alarmMode: AlarmMode;
}

// /api/heating endpoint
export interface HeatingUpdateRequest {
  centralHeating?: CentralHeatingMode;
  dhw?: DHWHeatingMode;
}

export interface HeatingStatusResponse {
  centralHeating: CentralHeatingMode | null;
  dhw: DHWHeatingMode;
}

// /api/users endpoint
export type UsersApiResponse = UserResponse[];

// /api/users/:id endpoint
export interface UserUpdateRequest {
  status?: UserStatus;
  eta?: number;
}

export type UserResponse = {
  id: string;
  avatar: string;
} & ({
  status: 'HOME',
  since: number,
  until: null
} | {
  status: 'AWAY',
  since: null,
  until: number | null
});

// Timeline Feed API response types (/api/timeline)
export type TimelineFeedEvent =
  | { type: 'motion'; id: number; timestamp: number; deviceId: number; deviceName: string; recordingId: number | null; }
  | { type: 'arrival'; id: number; timestamp: number; userId: string; }
  | { type: 'departure'; id: number; timestamp: number; userId: string; }
  | { type: 'light-on'; id: number; timestamp: number; deviceId: number; deviceName: string; }
  | { type: 'light-off'; id: number; timestamp: number; deviceId: number; deviceName: string; duration: number; }
  | { type: 'alarm-arming'; id: number; timestamp: number; mode: AlarmMode; }
  | { type: 'doorbell-ring'; id: number; timestamp: number; };

export interface TimelineFeedApiResponse {
  events: TimelineFeedEvent[];
  hasMore: boolean;
}