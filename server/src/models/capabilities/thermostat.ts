import { ThermostatBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { ScheduledChange } from './index';

export class ThermostatCapability extends ThermostatBaseCapability {
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
}
