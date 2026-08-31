import { Device } from '../';
import { ProviderThermostatCapabilityBase, ProviderElectricVehicleCapabilityBase, ProviderTelevisionCapabilityBase, HeatPumpHotWaterMode } from './capabilities.gen';

export { LightCapability } from './light';
export { LockCapability } from './lock';
export { SpeakerCapability } from './speaker';
export { ThermostatCapability } from './thermostat';
export { ElectricVehicleCapability } from './electric-vehicle';
export { HeatPumpCapability } from './heat-pump';
export { TelevisionCapability } from './television';
export { BinCollectionCapability } from './bin-collection';
export * from './capabilities.gen';

export interface DHWPlannedWindow {
  start: string;
  end: string;
  averagePence: number;
}

export interface ProviderHeatPumpCapability {
  setDHWMode(device: Device, mode: HeatPumpHotWaterMode): Promise<void>;
  setDHWBoost(device: Device, on: boolean): Promise<void>;
  getPlannedDHWWindow(device: Device): DHWPlannedWindow | null;
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

export interface NextChargeSchedule {
  targetPercentage: number;
  targetTime: string;
}

export interface ManualChargeSchedule {
  targetPercentage: number;
  targetTime: string;
}

export interface ProviderElectricVehicleCapability extends ProviderElectricVehicleCapabilityBase {
  getNextChargeSchedule(device: Device): NextChargeSchedule | null;
  setManualChargeSchedule(device: Device, schedule: ManualChargeSchedule | null): Promise<void>;
  getPlannedChargeBlocks(device: Device): { start: string; end: string }[];
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