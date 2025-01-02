import { Device } from '../../models';

export default class Thermostat {
  #device: Device;

  __typename = 'Thermostat';

  constructor(device: Device) {
    this.#device = device;
  }

  targetTemperature(): Promise<number> {
    return this.#device.getThermostatCapability().getTargetTemperature();
  }

  currentTemperature(): Promise<number> {
    return this.#device.getThermostatCapability().getCurrentTemperature();
  }

  isHeating(): Promise<boolean> {
    return this.#device.getThermostatCapability().getIsHeating();
  }

  humidity(): Promise<number> {
    return this.#device.getHumiditySensorCapability().getHumidity();
  }

  power(): Promise<number> {
    return this.#device.getThermostatCapability().getPower();
  }
}