import { Device } from '../models';
import { HeatPumpMode } from '../models/capabilities';
import { getter as numericGetter, setter as numericSetter } from './helpers/numeric_property';

export class HeatPumpCapability {
  #device: Device;

  constructor(device: Device) {
    this.#device = device;
  }

  async getCompressorModulation(): Promise<number> {
    return numericGetter(this.#device, 'compressor_modulation');
  }

  async setCompressorModulationState(value: number): Promise<void> {
    return numericSetter(this.#device, 'compressor_modulation', value, new Date());
  }

  async getDailyConsumedEnergy(): Promise<number> {
    return numericGetter(this.#device, 'energy_daily');
  }

  async setDailyConsumedEnergyState(value: number): Promise<void> {
    return numericSetter(this.#device, 'energy_daily', value, new Date());
  }

  async getDHWTemperature(): Promise<number> {
    return numericGetter(this.#device, 'hwc_temperature');
  }

  async setDHWTemperatureState(value: number): Promise<void> {
    return numericSetter(this.#device, 'hwc_temperature', value, new Date());
  }

  async getHeatingCoP(): Promise<number> {
    return numericGetter(this.#device, 'cop_hc');
  }

  async setHeatingCoPState(value: number): Promise<void> {
    return numericSetter(this.#device, 'cop_hc', value, new Date());
  }

  async getMode(): Promise<HeatPumpMode> {
    return numericGetter(this.#device, 'mode');
  }

  async setModeState(value: number): Promise<void> {
    return numericSetter(this.#device, 'mode', value, new Date());
  }
};