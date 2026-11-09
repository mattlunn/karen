import { ThermostatBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { ScheduledChange } from './index';

export class ThermostatCapability extends ThermostatBaseCapability {
  setTargetTemperatureUntilNextScheduledChange(value: number): Promise<void> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideThermostatCapability!()
      .setTargetTemperatureUntilNextScheduledChange(this.device, value);
  }

  setTargetTemperatureUntil(value: number, until: Date): Promise<void> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideThermostatCapability!()
      .setTargetTemperatureUntil(this.device, value, until);
  }

  async getNextScheduledChange(): Promise<ScheduledChange | null> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideThermostatCapability!()
      .getNextScheduledChange(this.device);
  }

  async getScheduledTemperatureAtTime(timestamp: Date): Promise<number | null> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideThermostatCapability!()
      .getScheduledTemperatureAtTime(this.device, timestamp);
  }

  async getWarmupRate(): Promise<number> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideThermostatCapability!()
      .getWarmupRate(this.device);
  }
}
