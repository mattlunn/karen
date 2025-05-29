import { Capability } from '.';
import { Device } from '../models';
import { HeatPumpMode } from '../models/capabilities';
import { numericProperty, numericGetter, numericSetter } from './helpers';

export type HeatPumpCapabilityProviderHandlers = never;

@numericProperty('CompressorModulation', { dbName: 'compressor_modulation' })
@numericProperty('DailyConsumedEnergy', { dbName: 'energy_daily' })
@numericProperty('DHWTemperature', { dbName: 'hwc_temperature' })
@numericProperty('HeatingCoP', { dbName: 'cop_hc' })
@numericProperty('Mode', { dbName: 'mode' })
export class HeatPumpCapability extends Capability<HeatPumpCapability, HeatPumpCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, undefined);
  }

  declare getCompressorModulation: () => Promise<number>;
  declare setCompressorModulationState: (modulation: number) => Promise<void>;

  declare getDailyConsumedEnergy: () => Promise<number>;
  declare setDailyConsumedEnergyState: (energy: number) => Promise<void>;

  declare getDHWTemperature: () => Promise<number>;
  declare setDHWTemperatureState: (temperature: number) => Promise<void>;

  declare getHeatingCoP: () => Promise<number>;
  declare setHeatingCoPState: (cop: number) => Promise<void>;

  declare getMode: () => Promise<HeatPumpMode>;
  declare setModeState: (mode: HeatPumpMode) => Promise<void>;
};
