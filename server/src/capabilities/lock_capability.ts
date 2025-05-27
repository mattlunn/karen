import { Device } from '../models';
import { booleanProperty } from './helpers';

@booleanProperty('IsLocked', { dbName: 'locked' })
export class LockCapability {
  device: Device;
  handlers: Pick<LockCapability, 'setIsLocked' | 'ensureIsLocked'>;

  constructor(device: Device) {
    this.device = device;
    
    const provider = Device._providers.get(device.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${device.provider} does not exist for device ${device.id} (${device.name})`);
    }

    const handler = provider.getLockCapability;

    if (handler === undefined) {
      throw new Error(`Provider ${device.provider} does not support LightCapability`);
    }

    this.handlers = handler(device);
  }

  async ensureIsLocked(signal: AbortSignal): Promise<void> {
    return this.handlers.ensureIsLocked(signal);
  }

  declare setIsLocked: (isLocked: boolean, signal?: AbortSignal) => Promise<void>;
}