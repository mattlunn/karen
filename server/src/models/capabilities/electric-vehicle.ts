import { ElectricVehicleBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { ChargeSchedule, NextChargeSchedule, ChargeType } from './index';

export class ElectricVehicleCapability extends ElectricVehicleBaseCapability {
  getNextChargeSchedule(): Promise<NextChargeSchedule | null> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideElectricVehicleCapability!()
      .getNextChargeSchedule(this.device);
  }

  setManualChargeSchedule(schedule: ChargeSchedule | null): Promise<void> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideElectricVehicleCapability!()
      .setManualChargeSchedule(this.device, schedule);
  }

  getPlannedChargeBlocks(): { start: string; end: string }[] {
    return Device.getProviderCapabilities(this.device.provider)
      .provideElectricVehicleCapability!()
      .getPlannedChargeBlocks(this.device);
  }

  getChargeType(): ChargeType | null {
    return Device.getProviderCapabilities(this.device.provider)
      .provideElectricVehicleCapability!()
      .getChargeType(this.device);
  }
}
