// Import basic shared types from server API
// Note: Full capability type migration requires extensive lambda code updates
// due to server using event-based structure {start, end, value} vs simple values
import type {
  DeviceStatus,
  AlarmMode,
  AlarmStatusResponse as AlarmApiResponse
} from '../../../../server/src/api/types';

// Re-export shared types
export type { DeviceStatus, AlarmMode, AlarmApiResponse };

// Lambda-specific capability types (simplified from server's event-based structure)
// TODO: Migrate to server's CapabilityApiResponse structure with event data
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

export type AlarmUpdateResponse = {
  alarmMode: AlarmMode;
};
