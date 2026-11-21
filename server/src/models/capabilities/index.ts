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
export { ApplianceCapability } from './appliance';
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
  setTargetTemperatureUntil(device: Device, value: number, until: Date): Promise<void>;
  getWarmupRate(device: Device): Promise<number>;
}

export interface ScheduleChargeRequest {
  targetPercentage: number;
  targetTime: string;
}

export interface ScheduledCharge extends ScheduleChargeRequest {
  // When the deadline starts being planned for: charge_deadline_engage_days before targetTime.
  startsAt: string;
}

// Which pass of the charge planner booked a slot: the opportunistic fill toward
// default_charge_limit, an engaged deadline's top-up, or a negative-price top-up.
export type ChargeType = 'BAU' | 'DEADLINE' | 'PLUNGE';

export interface PlannedChargeBlock {
  start: string;
  end: string;
  type: ChargeType;
}

export interface ProviderElectricVehicleCapability extends ProviderElectricVehicleCapabilityBase {
  getNextChargeSchedule(device: Device): ScheduledCharge | null;
  setManualChargeSchedule(device: Device, schedule: ScheduleChargeRequest | null): Promise<void>;
  getPlannedChargeBlocks(device: Device): PlannedChargeBlock[];
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

export interface DishwasherScheduledRun {
  start: Date;
  end: Date;
  finishBy: Date;
}

export type ProviderDishwasherCapability = {
  getScheduledRun(device: Device): DishwasherScheduledRun | null;
  scheduleToFinishBy(device: Device, finishBy: Date): Promise<DishwasherScheduledRun>;
}
