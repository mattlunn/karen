export interface ApiErrorResponse {
  error: string;
}

// Device API response - current status values with timestamps.
// State responses always carry an envelope (anchored to device.createdAt when
// no observation has happened yet) but `value` is null until first observation.
export type CapabilityApiResponse = {
  type: 'LIGHT';
  brightness: NumericStateApiResponse;
  isOn: BooleanStateApiResponse;
} | {
  type: 'THERMOSTAT';
  currentTemperature: NumericStateApiResponse;
  targetTemperature: NumericStateApiResponse;
  power: NumericStateApiResponse;
  isHeating: BooleanStateApiResponse;
  isPassive: BooleanStateApiResponse;
} | {
  type: 'HUMIDITY_SENSOR';
  humidity: NumericStateApiResponse;
} | {
  type: 'TEMPERATURE_SENSOR';
  currentTemperature: NumericStateApiResponse;
} | {
  type: 'LIGHT_SENSOR';
  illuminance: NumericStateApiResponse;
} | {
  type: 'MOTION_SENSOR';
  hasMotion: BooleanStateApiResponse;
} | {
  type: 'HEAT_PUMP';
  mode: EnumStateApiResponse;
  compressorModulation: NumericStateApiResponse;
  dhwTemperature: NumericStateApiResponse;
  outsideTemperature: NumericStateApiResponse;
  actualFlowTemperature: NumericStateApiResponse;
  returnTemperature: NumericStateApiResponse;
  systemPressure: NumericStateApiResponse;
  dayPower: NumericStateApiResponse;
  dayYield: NumericStateApiResponse;
  dayCoP: NumericStateApiResponse;
} | {
  type: 'CAMERA';
  snapshotUrl: EnumEventApiResponse;
} | {
  type: 'LOCK';
  isLocked: BooleanStateApiResponse;
} | {
  type: 'SPEAKER';
} | {
  type: 'BUTTON';
  lastPressed: BooleanEventApiResponse | null;
  pressesToday: number;
  totalPresses: number;
} | {
  type: 'SWITCH';
  isOn: BooleanStateApiResponse;
} | {
  type: 'TELEVISION';
  volume: NumericStateApiResponse;
  isMuted: BooleanStateApiResponse;
  currentSource: EnumStateApiResponse;
  availableSources: { label: string; kind: 'channel' | 'guide' }[];
} | {
  type: 'BATTERY_LEVEL_INDICATOR';
  batteryPercentage: NumericStateApiResponse;
} | {
  type: 'BATTERY_LOW_INDICATOR';
  isLow: BooleanStateApiResponse;
} | {
  type: 'ELECTRIC_VEHICLE';
  chargePercentage: NumericStateApiResponse;
  isCharging: BooleanStateApiResponse;
  isCableConnected: BooleanStateApiResponse;
  chargeLimit: NumericStateApiResponse;
  odometer: NumericStateApiResponse;
  chargeSchedule: { targetPercentage: number; targetTime: string; calculatedStartTime: string | null } | null;
} | {
  type: 'CONTACT_SENSOR';
  isClosed: BooleanStateApiResponse;
  lastTriggered: { start: string; end: string | null; durationSeconds: number | null } | null;
} | {
  type: 'BIN_COLLECTION';
  color: string;
  rrule: string;
  exdates: string[];
  overrides: Array<{ originalDate: string; newDate: string }>;
  nextCollection: { date: string; isOverride: boolean };
} | {
  type: 'CONNECTIVITY';
  isConnected: BooleanStateApiResponse;
} | {
  type: 'ENERGY_MONITOR';
  currentPower: NumericStateApiResponse;
  dayEnergy: NumericStateApiResponse;
  dayCost: NumericStateApiResponse;
} | {
  type: 'ENERGY_COST';
  unitRate: NumericStateApiResponse;
  standingCharge: NumericStateApiResponse;
} | {
  type: null;
};

// Current-state envelopes (live device data). `value` is null until the
// integration reports an observation; envelope timestamps are still present
// (anchored to device.createdAt when no observation exists).
export type BooleanStateApiResponse = {
  start: string;
  end: string | null;
  lastReported: string;
  value: boolean | null;
};

export type NumericStateApiResponse = {
  start: string;
  end: string | null;
  lastReported: string;
  value: number | null;
};

export type EnumStateApiResponse = {
  start: string;
  end: string | null;
  lastReported: string;
  value: string | null;
};

// History API response types (real DB rows; `value` is never null).
export type BooleanEventApiResponse = {
  start: string;
  end: string | null;
  lastReported: string;
  value: boolean;
};

export type NumericEventApiResponse = {
  start: string;
  end: string | null;
  lastReported: string;
  value: number;
};

export type EnumEventApiResponse = {
  start: string;
  end: string | null;
  lastReported: string;
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
  borderDash?: number[];
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
  type: 'light-on' | 'light-off' | 'motion-start' | 'motion-end' | 'heatpump-mode' | 'button-press' | 'connectivity-online' | 'connectivity-offline';
  timestamp: string;
  value?: string;
};

export type DeviceTimelineApiResponse = {
  since: string;
  until: string;
  events: DeviceTimelineEventApiResponse[];
};

// Common types
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
  manufacturer: string;
  model: string;
  provider: string;
  providerId: string;
  roomId: number | null;
  lastSeen: string;
  capabilities: CapabilityApiResponse[];
}

export interface BrokenDeviceResponse {
  id: number;
  name: string;
  provider: string;
  providerId: string;
}

export interface DevicesApiResponse {
  rooms: HomeRoom[];
  devices: RestDeviceResponse[];
  brokenDevices: BrokenDeviceResponse[];
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

// /api/device/:id/vehicle endpoint
export interface VehicleUpdateRequest {
  chargeLimit?: number;
  manualChargeSchedule?: { targetPercentage: number; targetTime: string } | null;
}

// /api/device/:id/switch endpoint
export interface SwitchUpdateRequest {
  isOn: boolean;
}

// /api/device/:id/television endpoint
export interface TelevisionUpdateRequest {
  volume?: number;
  isMuted?: boolean;
  source?: string;
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
  preWarmStartTime: string | null;
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

// /api/insights/heating endpoint
export interface HeatingInsightsApiResponse {
  lines: (HistoryLineApiResponse & { deviceName: string })[];
  modes: HistoryModesApiResponse;
  temperatureDeltas: (HistoryLineApiResponse & { deviceName: string })[];
  temperatureDeltaSwitchOnThreshold: number | null;
  heatPump: { id: number; name: string };
}

// /api/insights/energy endpoint
export interface EnergyInsightsApiResponse {
  usage: (HistoryLineApiResponse & { deviceId: number; deviceName: string })[];
  cost: (HistoryLineApiResponse & { deviceId: number; deviceName: string })[];
}

export interface DeviceUpdateEvent {
  type: 'device_update';
  device: RestDeviceResponse;
}

export type SSEEvent = DeviceUpdateEvent | { type: 'connected' };