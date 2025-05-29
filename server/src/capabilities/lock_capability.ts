import { Capability } from '.';
import { Device } from '../models';
import { booleanProperty } from './helpers';

export type LockCapabilityProviderHandlers = 'setIsLocked' | 'ensureIsLocked';

@booleanProperty('IsLocked', { dbName: 'locked' })
export class LockCapability extends Capability<LockCapability, LockCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, Device.getProviderOrThrow(device.provider)!.getLockCapability);
  }

  async ensureIsLocked(signal: AbortSignal): Promise<void> {
    return this.handlers.ensureIsLocked(signal);
  }

  declare setIsLocked: (isLocked: boolean) => Promise<void>;
  declare setIsLockedState: (isLocked: boolean) => Promise<void>;
  declare getIsLocked: () => Promise<boolean>;
}