import { Device } from '../models';
import { getter as booleanGetter, setter as booleanSetter } from './helpers/boolean_property';
import { getter as numericGetter, setter as numericSetter } from './helpers/numeric_property';

export class LightCapability {
  #device: Device;
  #handlers: Pick<LightCapability, 'setBrightness' | 'setIsOn'>;

  constructor(device: Device) {
    this.#device = device;
    
    const provider = Device._providers.get(device.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${device.provider} does not exist for device ${device.id} (${device.name})`);
    }

    const handlers = provider.getLightCapability(device);

    if (handlers === undefined) {
      throw new Error(`Provider ${device.provider} does not support LightCapability`);
    }

    this.#handlers = handlers;
  }

  async getBrightness(): Promise<Number> {
    return numericGetter(this.#device, 'brightness');
  }

  async setBrightness(brightness: number): Promise<void> {
    return this.#handlers.setBrightness(brightness);
  }

  async setBrightnessState(brightness: number): Promise<void> {
    return numericSetter(this.#device, 'brightness', brightness, new Date());
  }

  getIsOn(): Promise<boolean> {
    return booleanGetter(this.#device, 'on');
  }

  async setIsOn(isOn: boolean): Promise<void> {
    return this.#handlers.setIsOn(isOn);
  }
  async setIsOnState(isOn: boolean): Promise<void> {
    return booleanSetter(this.#device, 'on', isOn, new Date());
  }
}