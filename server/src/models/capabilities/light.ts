import { Device } from '../device';
import { getBooleanProperty, setBooleanProperty } from './helpers/boolean';
import { getNumericProperty, setNumericProperty } from './helpers/number';

export class LightCapability {
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

  getBrightness(): Promise<number> {
    return getNumericProperty(this.#device, 'brightness');
  }

  setBrightnessState(brightness: number): Promise<void> {
    return setNumericProperty(this.#device, 'brightness', brightness);
  }

  setBrightness(brightness: number): Promise<void> { 
    return Device.getProviderCapabilities(this.#device.provider).provideLightCapability!().setBrightness(this.#device, brightness);
  }
}