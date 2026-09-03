import { Device, StringEvent } from '..';
import { DishwasherBaseCapability } from './capabilities.gen';
import { DishwasherScheduledRun } from './index';

export class DishwasherCapability extends DishwasherBaseCapability {
  getLastMachineCareRun(): Promise<StringEvent | null> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideDishwasherCapability!()
      .getLastMachineCareRun(this.device);
  }

  getScheduledRun(): DishwasherScheduledRun | null {
    return Device.getProviderCapabilities(this.device.provider)
      .provideDishwasherCapability!()
      .getScheduledRun(this.device);
  }

  scheduleCheapestRun(): Promise<void> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideDishwasherCapability!()
      .scheduleCheapestRun(this.device);
  }

  cancelScheduledRun(): Promise<void> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideDishwasherCapability!()
      .cancelScheduledRun(this.device);
  }
}
