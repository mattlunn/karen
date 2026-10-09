import { getPreconditioningMode, buildClimateOptions } from './preconditioning';
import type { BridgeVehicle } from './types';

const presets = {
  heat: { temperature: 24, defrost: true, rear_window_heater: true, steering_wheel_heater: true },
  cool: { temperature: 18, defrost: false, rear_window_heater: false, steering_wheel_heater: false },
};

function vehicle(climate: Pick<BridgeVehicle, 'air_control_is_on' | 'air_temperature' | 'engine_is_running'>): BridgeVehicle {
  return {
    id: 'abc',
    name: null,
    model: null,
    ev_battery_percentage: null,
    ev_battery_is_charging: null,
    ev_battery_is_plugged_in: null,
    ev_charge_limits_ac: null,
    odometer: null,
    odometer_unit: null,
    location_latitude: null,
    location_longitude: null,
    ...climate,
  };
}

describe('getPreconditioningMode', () => {
  it('is HEAT when running at or above the midpoint of the presets', () => {
    expect(getPreconditioningMode(vehicle({ air_control_is_on: 8, air_temperature: 24, engine_is_running: 0 }), presets)).toBe('HEAT');
    expect(getPreconditioningMode(vehicle({ air_control_is_on: 8, air_temperature: 21, engine_is_running: 0 }), presets)).toBe('HEAT');
  });

  it('is COOL when running below the midpoint of the presets', () => {
    expect(getPreconditioningMode(vehicle({ air_control_is_on: 10, air_temperature: 18, engine_is_running: 0 }), presets)).toBe('COOL');
    expect(getPreconditioningMode(vehicle({ air_control_is_on: 10, air_temperature: 20.5, engine_is_running: 0 }), presets)).toBe('COOL');
  });

  it('ignores the stale set temperature once the blower has stopped', () => {
    expect(getPreconditioningMode(vehicle({ air_control_is_on: 0, air_temperature: 24, engine_is_running: 0 }), presets)).toBeNull();
  });

  it('is null while the car is being driven', () => {
    expect(getPreconditioningMode(vehicle({ air_control_is_on: 10, air_temperature: 18, engine_is_running: 1 }), presets)).toBeNull();
  });

  it('is null without a set temperature', () => {
    expect(getPreconditioningMode(vehicle({ air_control_is_on: 10, air_temperature: null, engine_is_running: 0 }), presets)).toBeNull();
  });
});

describe('buildClimateOptions', () => {
  it('maps the heat preset, with the steering wheel heater as its own option', () => {
    expect(buildClimateOptions(presets.heat, 10)).toEqual({
      set_temp: 24,
      duration: 10,
      climate: true,
      defrost: true,
      heating: 1,
      steering_wheel: 1,
    });
  });

  it('maps the cool preset', () => {
    expect(buildClimateOptions(presets.cool, 15)).toEqual({
      set_temp: 18,
      duration: 15,
      climate: true,
      defrost: false,
      heating: 0,
      steering_wheel: 0,
    });
  });
});
