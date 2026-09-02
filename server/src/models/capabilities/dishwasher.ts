import { Device, StringEvent } from '..';
import { DishwasherBaseCapability } from './capabilities.gen';

export class DishwasherCapability extends DishwasherBaseCapability {
  getLastMachineCareRun(): Promise<StringEvent | null> {
    return Device.getProviderCapabilities(this.device.provider).provideDishwasherCapability!().getLastMachineCareRun(this.device);
  }
}
