import { Device } from '../';
import { ProviderThermostatCapabilityBase, ProviderElectricVehicleCapabilityBase, ProviderTelevisionCapabilityBase, ProviderHeatPumpCapabilityBase, ProviderMotionSensorSensitivityCapabilityBase } from './capabilities.gen';

export { LightCapability } from './light';
export { LockCapability } from './lock';
export { MotionSensorSensitivityCapability } from './motion-sensor-sensitivity';
export { SpeakerCapability } from './speaker';
export { ThermostatCapability } from './thermostat';
export { ElectricVehicleCapability } from './electric-vehicle';
export { HeatPumpCapability } from './heat-pump';
export { TelevisionCapability } from './television';
export { BinCollectionCapability } from './bin-collection';
export * from './capabilities.gen';

export type DHWTargetReason = 'STANDARD' | 'PLUNGE' | 'LEGIONELLA';

export interface DHWPlannedWindow {
  start: string;
  end: string;
  targetTemp: number;
  reason: DHWTargetReason;
}

export interface ProviderHeatPumpCapability extends ProviderHeatPumpCapabilityBase {
  getPlannedDHWWindow(device: Device): DHWPlannedWindow | null;
  getLegionellaCycles(device: Device, since: Date, until: Date, limit?: number): Promise<Date[]>;
}

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

export interface ChargeSchedule {
  targetPercentage: number;
  targetTime: string;
}

export interface ProviderElectricVehicleCapability extends ProviderElectricVehicleCapabilityBase {
  getNextChargeSchedule(device: Device): ChargeSchedule | null;
  setManualChargeSchedule(device: Device, schedule: ChargeSchedule | null): Promise<void>;
  getPlannedChargeBlocks(device: Device): { start: string; end: string }[];
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