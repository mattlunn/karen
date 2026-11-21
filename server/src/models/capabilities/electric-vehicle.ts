import { ElectricVehicleBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { ScheduleChargeRequest, ScheduledCharge, PlannedChargeBlock } from './index';

export class ElectricVehicleCapability extends ElectricVehicleBaseCapability {
  getNextChargeSchedule(): ScheduledCharge | null {
    return Device.getProviderCapabilities(this.device.provider)
      .provideElectricVehicleCapability!()
      .getNextChargeSchedule(this.device);
  }

  setManualChargeSchedule(schedule: ScheduleChargeRequest | null): Promise<void> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideElectricVehicleCapability!()
      .setManualChargeSchedule(this.device, schedule);
  }

  getPlannedChargeBlocks(): PlannedChargeBlock[] {
    return Device.getProviderCapabilities(this.device.provider)
      .provideElectricVehicleCapability!()
      .getPlannedChargeBlocks(this.device);
  }
}
