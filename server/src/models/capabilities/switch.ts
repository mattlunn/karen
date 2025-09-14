import { Device } from '../device';
import { getBooleanProperty, setBooleanProperty } from './helpers/boolean';

export class SwitchCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;
  
  getIsOn(): Promise<boolean> {
    return getBooleanProperty(this.#device, 'on');
  }

  setIsOn(isOn: boolean): Promise<void> {
    return Device.getProviderCapabilities(this.#device.provider).provideLightCapability!().setIsOn(this.#device, isOn);
  }

  setIsOnState(isOn: boolean): Promise<void> {
    return setBooleanProperty(this.#device, 'on', isOn);
  }
}