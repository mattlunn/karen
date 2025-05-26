import { Device } from "../models";

export default class BatteryLowIndicatorCapability {
  #device: Device;

  constructor(device: Device) {
    this.#device = device;
  }
  
  async getIsBatteryLow(): Promise<boolean> {
    return ((await this.#device.getLatestEvent('battery_low'))?.value ?? 0) === 1;
  }
}