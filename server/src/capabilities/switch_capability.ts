import { Capability } from '.';
import { Device } from '../models';
import { booleanProperty } from './helpers';

export type SwitchCapabilityProviderHandlers = 'setIsOn';

@booleanProperty('IsOn', { dbName: 'on', writeable: true })
export class SwitchCapability extends Capability<SwitchCapability, SwitchCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, Device.getProviderOrThrow(device.provider)!.getSwitchCapability);
  }

  declare setIsOn: (isOn: boolean, signal?: AbortSignal) => Promise<void>;
  declare getIsOn: () => Promise<boolean>;
  declare setIsOnState: (isOn: boolean) => Promise<void>;
}