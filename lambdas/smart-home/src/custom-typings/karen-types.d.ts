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

export type DeviceStatus = 'OK' | 'OFFLINE';
export type AlarmMode = 'OFF' | 'AWAY' | 'NIGHT';

// REST API response types
export type DevicesApiResponse = {
  devices: Device[];
};

export type DeviceApiResponse = {
  device: Device;
};

export type AlarmApiResponse = {
  alarmMode: AlarmMode;
};

export type LightApiResponse = {
  device: Device;
};

export type AlarmUpdateResponse = {
  alarmMode: AlarmMode;
};
