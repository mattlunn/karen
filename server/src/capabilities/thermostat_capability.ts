import { Device } from '../models';
import { getter as booleanGetter, setter as booleanSetter } from './helpers/boolean_property';
import { getter as numericGetter, setter as numericSetter } from './helpers/numeric_property';

export class ThermostatCapability {
  #device: Device;
  #handlers: Pick<ThermostatCapability, 'setTargetTemperature' | 'setIsOn'>;

  constructor(device: Device) {
    this.#device = device;
    
    const provider = Device._providers.get(device.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${device.provider} does not exist for device ${device.id} (${device.name})`);
    }

    const handlers = provider.getLightCapability(device);

    if (handlers === undefined) {
      throw new Error(`Provider ${device.provider} does not support LightCapability`);
    }

    this.#handlers = handlers;
  }

  async getCurrentTemperature(): Promise<number> {
    return numericGetter(this.#device, 'temperature');
  }

  async setCurrentTemperatureState(temperature: number): Promise<void> {
    return numericSetter(this.#device, 'temperature', temperature, new Date());
  }

  async getPower(): Promise<Number> {
    return numericGetter(this.#device, 'power');
  }

  async setPowerState(power: number): Promise<void> {
    return numericSetter(this.#device, 'power', power, new Date());
  }

  async getHeating(): Promise<boolean> {
    return booleanGetter(this.#device, 'heating');
  }

  async setHeatingState(heating: boolean): Promise<void> {
    return booleanSetter(this.#device, 'heating', heating, new Date());
  }

  async getTargetTemperature(): Promise<number> {
    return numericGetter(this.#device, 'target');
  }

  async setTargetTemperatureState(temperature: number): Promise<void> {
    return numericSetter(this.#device, 'target', temperature, new Date());
  }

  async setTargetTemperature(temperature: number): Promise<void> {
    return this.#handlers.setTargetTemperature(temperature);
  }

  getIsOn(): Promise<boolean> {
    return booleanGetter(this.#device, 'on');
  }

  async setIsOn(isOn: boolean): Promise<void> {
    return this.#handlers.setIsOn(isOn);
  }
}