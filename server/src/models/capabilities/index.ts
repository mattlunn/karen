import { Device } from '../';
import { ProviderThermostatCapabilityBase, ProviderElectricVehicleCapabilityBase, ProviderTelevisionCapabilityBase, ProviderHeatPumpCapabilityBase, ProviderMotionSensorSensitivityCapabilityBase } from './capabilities.gen';
import { PriceSlot } from '../../helpers/prices';

export { LightCapability } from './light';
export { LockCapability } from './lock';
export { MotionSensorSensitivityCapability } from './motion-sensor-sensitivity';
export { SpeakerCapability } from './speaker';
export { ThermostatCapability } from './thermostat';
export { ElectricVehicleCapability } from './electric-vehicle';
export { HeatPumpCapability } from './heat-pump';
export { TelevisionCapability } from './television';
export { BinCollectionCapability } from './bin-collection';
export { EnergyCostCapability } from './energy-cost';
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

export interface ScheduleChargeRequest {
  targetPercentage: number;
  targetTime: string;
}

export interface ScheduledCharge extends ScheduleChargeRequest {
  // When opportunistic charging will hand over to this deadline: charge_deadline_engage_days before targetTime.
  startsAt: string;
}

// Which pass of the charge planner the committed plan's slots came from: an
// engaged recurring deadline, a negative-price top-up, or the opportunistic
// fill toward default_charge_limit.
export type ChargeType = 'BAU' | 'DEADLINE' | 'PLUNGE';

export interface ProviderElectricVehicleCapability extends ProviderElectricVehicleCapabilityBase {
  getNextChargeSchedule(device: Device): ScheduledCharge | null;
  setManualChargeSchedule(device: Device, schedule: ScheduleChargeRequest | null): Promise<void>;
  getPlannedChargeBlocks(device: Device): { start: string; end: string }[];
  getChargeType(device: Device): ChargeType | null;
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

export type ProviderEnergyCostCapability = {
  getForecastSlots(device: Device, since: Date, until: Date): Promise<PriceSlot[]>;
}