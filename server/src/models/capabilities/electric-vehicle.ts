import { ElectricVehicleBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { NextChargeSchedule, ManualChargeSchedule } from './index';

export class ElectricVehicleCapability extends ElectricVehicleBaseCapability {
  getNextChargeSchedule(): NextChargeSchedule | null {
    return Device.getProviderCapabilities(this.device.provider)
      .provideElectricVehicleCapability!()
      .getNextChargeSchedule(this.device);
  }

  setManualChargeSchedule(schedule: ManualChargeSchedule | null): Promise<void> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideElectricVehicleCapability!()
      .setManualChargeSchedule(this.device, schedule);
  }

  // The charge blocks the scheduler is currently driving (deadline windows or
  // BAU opportunistic blocks), for surfacing the planned run windows in the UI.
  getPlannedChargeBlocks(): { start: string; end: string }[] {
    return Device.getProviderCapabilities(this.device.provider)
      .provideElectricVehicleCapability!()
      .getPlannedChargeBlocks(this.device);
  }
}
