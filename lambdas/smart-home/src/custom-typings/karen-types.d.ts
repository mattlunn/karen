type LightCapability = {
  __typename: 'Light';
  isOn: boolean;
  brightness: number;
};

type SpeakerCapability = {
  __typename: 'Speaker';
};

type ThermostatCapability = {
  __typename: 'Thermostat';
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
