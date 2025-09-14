import { Device } from '../device';
import { getBooleanProperty, setBooleanProperty } from './helpers/boolean';
import { getNumericProperty, setNumericProperty } from './helpers/number';

export class HeatPumpCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;

  getMode(): Promise<number> {
    return getNumericProperty(this.#device, 'mode');
  }

  setModeState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'mode', value, timestamp);
  }

  getDHWCoP(): Promise<number> {
    return getNumericProperty(this.#device, 'cop_hwc');
  }

  setDHWCoPState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'cop_hwc', value, timestamp);
  }

  getHeatingCoP(): Promise<number> {
    return getNumericProperty(this.#device, 'cop_hc');
  }

  setHeatingCoPState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'cop_hc', value, timestamp);
  }

  getDHWIsOn(): Promise<boolean> {
    return getBooleanProperty(this.#device, 'dhw_mode');
  }

  setDHWIsOnState(value: boolean, timestamp?: Date): Promise<void> {
    return setBooleanProperty(this.#device, 'dhw_mode', value, timestamp);
  }

  getCurrentPower(): Promise<number> {
    return getNumericProperty(this.#device, 'current_power');
  }

  setCurrentPowerState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'current_power', value, timestamp);
  }

  getCurrentYield(): Promise<number> {
    return getNumericProperty(this.#device, 'current_yield');
  }

  setCurrentYieldState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'current_yield', value, timestamp);
  }

  getDailyConsumedEnergy(): Promise<number> {
    return getNumericProperty(this.#device, 'energy_daily');
  }

  setDailyConsumedEnergyState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'energy_daily', value, timestamp);
  }

  getCompressorModulation(): Promise<number> {
    return getNumericProperty(this.#device, 'compressor_modulation');
  }

  setCompressorModulationState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'compressor_modulation', value, timestamp);
  }

  getCompressorPower(): Promise<number> {
    return getNumericProperty(this.#device, 'compressor_power');
  }

  setCompressorPowerState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'compressor_power', value, timestamp);
  }

  getSystemPressure(): Promise<number> {
    return getNumericProperty(this.#device, 'system_pressure');
  }

  setSystemPressureState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'system_pressure', value, timestamp);
  }

  getDHWTemperature(): Promise<number> {
    return getNumericProperty(this.#device, 'hwc_temperature');
  }

  setDHWTemperatureState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'hwc_temperature', value, timestamp);
  }

  getDesiredFlowTemperature(): Promise<number> {
    return getNumericProperty(this.#device, 'desired_flow_temperature');
  }

  setDesiredFlowTemperatureState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'desired_flow_temperature', value, timestamp);
  }

  getReturnTemperature(): Promise<number> {
    return getNumericProperty(this.#device, 'return_temperature');
  }

  setReturnTemperatureState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'return_temperature', value, timestamp);
  }

  getOutsideTemperature(): Promise<number> {
    return getNumericProperty(this.#device, 'outside_temperature');
  }

  setOutsideTemperatureState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'outside_temperature', value, timestamp);
  }

  getActualFlowTemperature(): Promise<number> {
    return getNumericProperty(this.#device, 'actual_flow_temperature');
  }

  setActualFlowTemperatureState(value: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'actual_flow_temperature', value, timestamp);
  }
}