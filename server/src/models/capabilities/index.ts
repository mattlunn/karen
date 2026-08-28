import { Device } from '../';
import { ProviderThermostatCapabilityBase, ProviderElectricVehicleCapabilityBase, ProviderTelevisionCapabilityBase, ProviderMotionSensorSensitivityCapabilityBase } from './capabilities.gen';

export { LightCapability } from './light';
export { LockCapability } from './lock';
export { MotionSensorSensitivityCapability } from './motion-sensor-sensitivity';
export { SpeakerCapability } from './speaker';
export { ThermostatCapability } from './thermostat';
export { ElectricVehicleCapability } from './electric-vehicle';
export { TelevisionCapability } from './television';
export { BinCollectionCapability } from './bin-collection';
export * from './capabilities.gen';

export type ScheduledChange = {
  timestamp: Date;
  temperature: number;
};

export interface ProviderThermostatCapability extends ProviderThermostatCapabilityBase {
  getNextScheduledChange(device: Device): Promise<ScheduledChange | null>;
  getScheduledTemperatureAtTime(device: Device, timestamp: Date): Promise<number | null>;
  setTargetTemperatureUntilNextScheduledChange(device: Device, value: number): Promise<void>;
  getWarmupRate(device: Device): Promise<number>;
}

export interface NextChargeSchedule {
  targetPercentage: number;
  targetTime: string;
  calculatedStartTime: string | null;
}

export interface ManualChargeSchedule {
  targetPercentage: number;
  targetTime: string;
}

export interface ProviderElectricVehicleCapability extends ProviderElectricVehicleCapabilityBase {
  getNextChargeSchedule(device: Device): NextChargeSchedule | null;
  setManualChargeSchedule(device: Device, schedule: ManualChargeSchedule | null): Promise<void>;
}

export interface ProviderMotionSensorSensitivityCapability extends ProviderMotionSensorSensitivityCapabilityBase {
  // A sensitivity written but not yet confirmed by the device, or null when there
  // isn't one. Where that's tracked (and whether a provider has a pending state at
  // all) is the provider's own business - e.g. Z-Wave nodes sleep, so a write sits
  // unconfirmed until the device next checks in, whereas mains-powered devices
  // confirm synchronously and never report one.
  getPendingSensitivity(device: Device): number | null;
}

export interface TelevisionSource {
  label: string;
  kind: 'channel' | 'guide';
}

export interface ProviderTelevisionCapability extends ProviderTelevisionCapabilityBase {
  getAvailableSources(device: Device): TelevisionSource[];
}

export type ProviderSpeakerCapability = {
  emitSound(device: Device, sound: string | string[], ttlInSeconds?: number): Promise<void>;
}