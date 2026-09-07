import { Device, StringEvent } from '../';
import { ProviderThermostatCapabilityBase, ProviderElectricVehicleCapabilityBase, ProviderTelevisionCapabilityBase, ProviderHeatPumpCapabilityBase } from './capabilities.gen';

export { LightCapability } from './light';
export { LockCapability } from './lock';
export { SpeakerCapability } from './speaker';
export { ThermostatCapability } from './thermostat';
export { ElectricVehicleCapability } from './electric-vehicle';
export { HeatPumpCapability } from './heat-pump';
export { TelevisionCapability } from './television';
export { BinCollectionCapability } from './bin-collection';
export { DishwasherCapability } from './dishwasher';
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

export type ProviderDishwasherCapability = {
  getLastMachineCareRun(device: Device): Promise<StringEvent | null>;
}
