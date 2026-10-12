import { DishwasherBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { DishwasherScheduledRun } from './index';

export class DishwasherCapability extends DishwasherBaseCapability {
  getScheduledRun(): DishwasherScheduledRun | null {
    return Device.getProviderCapabilities(this.device.provider)
      .provideDishwasherCapability!()
      .getScheduledRun(this.device);
  }

  scheduleToFinishBy(finishBy: Date): Promise<DishwasherScheduledRun> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideDishwasherCapability!()
      .scheduleToFinishBy(this.device, finishBy);
  }

  cancelScheduledRun(): Promise<void> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideDishwasherCapability!()
      .cancelScheduledRun(this.device);
  }
}
