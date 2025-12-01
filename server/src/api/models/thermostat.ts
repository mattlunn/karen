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

  setbackTemperature(): Promise<number> {
    return this.#device.getThermostatCapability().getSetbackTemperature();
  }

  isHeating(): Promise<boolean> {
    return this.#device.getThermostatCapability().getIsOn();
  }

  humidity(): Promise<number> {
    return this.#device.getHumiditySensorCapability().getHumidity();
  }

  power(): Promise<number> {
    return this.#device.getThermostatCapability().getPower();
  }
}