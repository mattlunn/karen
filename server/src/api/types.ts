export interface ApiErrorResponse {
  error: string;
}

// Device API response - current status values with timestamps.
// State responses always carry an envelope (anchored to device.createdAt when
// no observation has happened yet) but `value` is null until first observation.
export type CapabilityApiResponseBase = {
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
  dhwIsBoosting: BooleanStateApiResponse;
  dhwMaxChargeTime: NumericStateApiResponse;
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
  availableSources: TelevisionSourceApiResponse[];
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
  chargeSchedule: { targetPercentage: number; targetTime: string } | null;
} | {
  type: 'ALARM_SENSOR';
  isTriggered: BooleanStateApiResponse;
  lastTriggered: { start: string; end: string | null; durationSeconds: number | null } | null;
} | {
  type: 'CONTACT_SENSOR';
  isOpen: BooleanStateApiResponse;
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
  standingCharge: NumericStateApiResponse;
} | {
  type: null;
};

// A device can expose several instances of one capability (e.g. a presence
// sensor reporting occupancy per zone), so `capabilities` may contain more
// than one entry of the same `type`, distinguished by `instanceId`. A null
// instanceId is the singleton instance - the device itself.
export type CapabilityInstanceMeta = {
  instanceId: string | null;
  instanceName: string | null;
};

// Intersecting distributes over the union, so narrowing on `type` still works.
export type CapabilityApiResponse = CapabilityApiResponseBase & CapabilityInstanceMeta;

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

export type TelevisionSourceApiResponse = {
  label: string;
  kind: 'channel' | 'guide';
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
  period?: 'day' | 'month';
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
  period?: 'day' | 'month';
};

export type HistoryApiResponse = {
  lines: HistoryLineApiResponse[];
  modes?: HistoryModesApiResponse[];
  bars?: HistoryBarApiResponse[];
};

// Device Timeline API response types (/api/device/:id/timeline)
export type DeviceTimelineEventApiResponse = {
  type: 'light-on' | 'light-off' | 'motion-start' | 'motion-end' | 'heatpump-mode' | 'button-press' | 'connectivity-online' | 'connectivity-offline' | 'switch-on';
  timestamp: string;
  value?: string;
  instanceName?: string | null;
} | {
  type: 'contact-opened';
  timestamp: string;
  durationSeconds: number | null;
} | {
  type: 'switch-off';
  timestamp: string;
  durationSeconds: number;
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
export type DHWHeatingMode = 'OFF' | 'AUTO';

export interface DHWStatus {
  mode: DHWHeatingMode;
  isBoosting: boolean;
  schedule: { start: string; end: string; averagePence: number } | null;
}

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
  start: string | null;
  activations: Array<{
    id: number;
    startedAt: string;
    suppressFurtherAlertsUntil: string;
    triggeringDevice: { id: number; name: string };
  }>;
}

export interface AlarmUpdateRequest {
  alarmMode: AlarmMode;
}

// /api/heating endpoint
export interface HeatingUpdateRequest {
  centralHeating?: CentralHeatingMode;
  dhw?: DHWHeatingMode;
  dhwBoost?: boolean;
}

export interface HeatingStatusResponse {
  centralHeating: CentralHeatingMode | null;
  dhwStatus: DHWStatus;
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

// /api/insights/heating endpoint
export interface HeatingInsightsApiResponse {
  lines: (HistoryLineApiResponse & { deviceName: string })[];
  modes: HistoryModesApiResponse[];
  temperatures: (HistoryLineApiResponse & { deviceName: string })[];
  temperatureDeltas: (HistoryLineApiResponse & { deviceName: string })[];
  temperatureDeltaSwitchOnThreshold: number | null;
  heatPump: { id: number; name: string };
}

// /api/insights/energy/usage endpoint - one non-stacked instantaneous-power
// line per ENERGY_MONITOR device (the whole-house meter included as-is).
export type EnergyUsageInsightsApiResponse = {
  series: HistoryLineApiResponse[];
};

// /api/insights/energy/cost endpoint - per-day cost of each sub-metered device
// (all LIGHT-capable devices summed into one "Lights" entry) as a stacked bar
// breakdown, plus the whole-house meter's own daily total as a separate overlay
// line. The gap between the stack and the line is the unmetered remainder.
export type EnergyCostInsightsApiResponse = {
  series: HistoryLineApiResponse[];
  total: HistoryLineApiResponse;
};

// /api/insights/energy/schedule endpoint - unit rate as a line with EV and DHW
// run windows (actual and planned) shaded beneath it. Each band is its own
// mode series so overlapping EV/DHW windows render honestly.
export interface EnergyScheduleApiResponse {
  lines: HistoryLineApiResponse[];
  modes: HistoryModesApiResponse[];
}

// /api/insights/security endpoint
export interface SecurityInsightsApiResponse {
  armings: Array<{
    id: number;
    mode: 'NIGHT' | 'AWAY';
    start: string;
    end: string | null;
    activations: Array<{
      id: number;
      startedAt: string;
      suppressFurtherAlertsUntil: string;
      triggeringDevice: { id: number; name: string };
    }>;
  }>;
  motionEvents: Array<{
    id: number;
    deviceId: number;
    deviceName: string;
    instanceId: string | null;
    instanceName: string | null;
    start: string;
    end: string | null;
    recordingId: number | null;
  }>;
  lockEvents: Array<{
    id: number;
    deviceId: number;
    deviceName: string;
    timestamp: string;
    isLocked: boolean;
  }>;
  contactEvents: Array<{
    id: number;
    deviceId: number;
    deviceName: string;
    timestamp: string;
    isOpen: boolean;
  }>;
  doorbellRings: Array<{
    id: number;
    deviceId: number;
    deviceName: string;
    timestamp: string;
    hasThumbnail: boolean;
  }>;
  motionByDeviceHour: Array<{
    deviceId: number;
    instanceId: string | null;
    label: string;
    // Always 24 entries, one motion count per hour of day (0-23).
    countByHour: number[];
    // Independent of the selected range - the device's last motion detection full-stop.
    lastMotion: string | null;
  }>;
  connectivityEvents: Array<{
    id: number;
    deviceId: number;
    deviceName: string;
    timestamp: string;
    isConnected: boolean;
  }>;
}

export interface DeviceUpdateEvent {
  type: 'device_update';
  device: RestDeviceResponse;
}

export type SSEEvent = DeviceUpdateEvent | { type: 'connected' };