// Import basic shared types from server API
import type {
  DeviceStatus,
  AlarmMode,
  AlarmStatusResponse as AlarmApiResponse,
  LightResponse,
  LockResponse,
  ThermostatResponse
} from '../../../../server/src/api/types';

// Re-export shared types
export type {
  DeviceStatus,
  AlarmMode,
  AlarmApiResponse,
  LightResponse,
  LockResponse,
  ThermostatResponse
};

// Lambda-specific capability types (for Alexa response properties)
// Note: Mutation endpoints return simple values (not event-based), so no migration needed
type LightCapability = {
  type: 'LIGHT';
  isOn: boolean;
  brightness: number;
};

type SpeakerCapability = {
  type: 'SPEAKER';
};

type ThermostatCapability = {
  type: 'THERMOSTAT';
  targetTemperature: number;
  currentTemperature: number;
  power: number;
  isHeating: boolean;
};

type Capability = LightCapability | ThermostatCapability | SpeakerCapability;

export type Device = {
  id: string;
  name: string;
  status: DeviceStatus;
  capabilities: Capability[];
}

// Lambda-specific API response types
export type DevicesApiResponse = {
  devices: Device[];
};

export type DeviceApiResponse = {
  device: Device;
};

export type LightApiResponse = {
  device: Device;
};
