import { Device } from '../device';
import { LightBaseCapability } from './capabilities.gen'

export class LightCapability extends LightBaseCapability {
  setBrightness(brightness: number): Promise<void> { 
    if (brightness === 0) {
      return Device.getProviderCapabilities(this.device.provider).provideLightCapability!().setIsOn(this.device, false);
    } else {
      return Device.getProviderCapabilities(this.device.provider).provideLightCapability!().setBrightness(this.device, brightness);
    }
  }
}