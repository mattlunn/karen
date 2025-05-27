import { Device } from '../models';
import { getter as booleanGetter, setter as booleanSetter } from './helpers/boolean_property';

export class SwitchCapability {
  #device: Device;
  #handlers: Pick<SwitchCapability, 'setIsOn'>;

  constructor(device: Device) {
    this.#device = device;
    
    const provider = Device._providers.get(device.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${device.provider} does not exist for device ${device.id} (${device.name})`);
    }

    const handler = provider.getSwitchCapability;

    if (handler === undefined) {
      throw new Error(`Provider ${device.provider} does not support LightCapability`);
    }

    this.#handlers = handler(device);
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