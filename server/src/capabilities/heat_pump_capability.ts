import { Device } from '../models';
import { HeatPumpMode } from '../models/capabilities';
import { numericProperty, numericGetter, numericSetter } from './helpers';

@numericProperty('CompressorModulation', { dbName: 'compressor_modulation' })
@numericProperty('DailyConsumedEnergy', { dbName: 'energy_daily' })
@numericProperty('DHWTemperature', { dbName: 'hwc_temperature' })
@numericProperty('HeatingCoP', { dbName: 'cop_hc' })
@numericProperty('Mode', { dbName: 'mode' })
export class HeatPumpCapability {
  device: Device;

  constructor(device: Device) {
    this.device = device;
  }

  async getMode(): Promise<HeatPumpMode> {
    return numericGetter(this.device, 'mode');
  }

  async setModeState(value: number): Promise<void> {
    return numericSetter(this.device, 'mode', value, new Date());
  }
};
