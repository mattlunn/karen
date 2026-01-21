// Import basic shared types from server API
import type {
  DeviceStatus,
  AlarmMode,
  AlarmStatusResponse as AlarmApiResponse,
  CapabilityApiResponse,
  BooleanEventApiResponse,
  NumericEventApiResponse
} from '../../../../server/src/api/types';

// Re-export shared types
export type {
  DeviceStatus,
  AlarmMode,
  AlarmApiResponse,
  BooleanEventApiResponse,
  NumericEventApiResponse
};

// Device type using server's event-based capability structure
export type Device = {
  id: number;
  name: string;
  status: DeviceStatus;
  capabilities: CapabilityApiResponse[];
}

// Lambda-specific API response types
export type DevicesApiResponse = {
  devices: Device[];
};

export type DeviceApiResponse = {
  device: Device;
};
