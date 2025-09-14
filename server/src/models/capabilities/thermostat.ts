import { Device } from '../device';
import { getBooleanProperty, setBooleanProperty } from './helpers/boolean';
import { getNumericProperty, setNumericProperty } from './helpers/number';

export class ThermostatCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;
  
  getIsOn(): Promise<boolean> {
    return getBooleanProperty(this.#device, 'heating');
  }

  setIsOnState(isOn: boolean, timestamp?: Date): Promise<void> {
    return setBooleanProperty(this.#device, 'heating', isOn, timestamp);
  }

  setIsOn(isOn: boolean): Promise<void> {
    return Device.getProviderCapabilities(this.#device.provider).provideThermostatCapability!().setIsOn(this.#device, isOn);
  }

  getPower(): Promise<number> {
    return getNumericProperty(this.#device, 'power');
  }

  setPowerState(power: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'power', power, timestamp);
  }

  getHumidity(): Promise<number> {
    return getNumericProperty(this.#device, 'humidity');
  }

  setHumidityState(humidity: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'humidity', humidity, timestamp);
  }

  getCurrentTemperature(): Promise<number> {
    return getNumericProperty(this.#device, 'temperature');
  }

  setCurrentTemperatureState(temperature: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'temperature', temperature, timestamp);
  }

  getTargetTemperature(): Promise<number> {
    return getNumericProperty(this.#device, 'target');
  }

  setTargetTemperatureState(target: number, timestamp?: Date): Promise<void> {
    return setNumericProperty(this.#device, 'target', target, timestamp);
  }

  setTargetTemperature(target: number): Promise<void> {
    return Device.getProviderCapabilities(this.#device.provider).provideThermostatCapability!().setTargetTemperature(this.#device, target);
  }
}