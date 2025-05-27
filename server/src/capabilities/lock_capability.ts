import { Device } from '../models';
import { getter as booleanGetter, setter as booleanSetter } from './helpers/boolean_property';

export class LockCapability {
  #device: Device;
  #handlers: Pick<LockCapability, 'setIsLocked' | 'ensureIsLocked'>;

  constructor(device: Device) {
    this.#device = device;
    
    const provider = Device._providers.get(device.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${device.provider} does not exist for device ${device.id} (${device.name})`);
    }

    const handler = provider.getLockCapability;

    if (handler === undefined) {
      throw new Error(`Provider ${device.provider} does not support LightCapability`);
    }

    this.#handlers = handler(device);
  }

  getIsLocked(): Promise<boolean> {
    return booleanGetter(this.#device, 'locked');
  }

  async setIsLocked(isOn: boolean): Promise<void> {
    return this.#handlers.setIsLocked(isOn);
  }

  async ensureIsLocked(signal: AbortSignal): Promise<void> {
    return this.#handlers.ensureIsLocked(signal);
  }

  async setIsLockedState(isOn: boolean): Promise<void> {
    return booleanSetter(this.#device, 'locked', isOn, new Date());
  }
}