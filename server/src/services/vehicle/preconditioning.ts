import type { PreconditioningPreset } from '../../config';
import type { BridgeVehicle, ClimateOptions } from './types';

export type PreconditioningMode = 'HEAT' | 'COOL';

interface Presets {
  heat: PreconditioningPreset;
  cool: PreconditioningPreset;
}

// The car only reports a set temperature, so the mode is whichever preset it's nearer to.
export function getPreconditioningMode(vehicle: BridgeVehicle, presets: Presets): PreconditioningMode | null {
  if (!vehicle.air_control_is_on || vehicle.engine_is_running || vehicle.air_temperature === null) {
    return null;
  }

  const midpoint = (presets.heat.temperature + presets.cool.temperature) / 2;

  return vehicle.air_temperature >= midpoint ? 'HEAT' : 'COOL';
}

export function buildClimateOptions(preset: PreconditioningPreset, durationMinutes: number): ClimateOptions {
  return {
    set_temp: preset.temperature,
    duration: durationMinutes,
    climate: true,
    defrost: preset.defrost,
    heating: preset.rear_window_heater ? 1 : 0,
    steering_wheel: preset.steering_wheel_heater ? 1 : 0,
  };
}
