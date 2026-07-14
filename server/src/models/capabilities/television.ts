import { TelevisionBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { TelevisionSource } from './index';

export class TelevisionCapability extends TelevisionBaseCapability {
  getAvailableSources(): TelevisionSource[] {
    return Device.getProviderCapabilities(this.device.provider)
      .provideTelevisionCapability!()
      .getAvailableSources(this.device);
  }
}
