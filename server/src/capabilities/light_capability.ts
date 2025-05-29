import { Capability } from '.';
import { Device } from '../models';
import { numericProperty, booleanProperty } from './helpers';

export type LightCapabilityProviderHandlers = 'setBrightness' | 'setIsOn';

@numericProperty('Brightness', { dbName: 'brightness', writeable: true })
@booleanProperty('IsOn', { dbName: 'on', writeable: true })
export class LightCapability extends Capability<LightCapability, LightCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, Device.getProviderOrThrow(device.provider)!.getLightCapability);
  }

  declare setBrightness: (brightness: number) => Promise<void>;
  declare setBrightnessState: (brightness: number) => Promise<void>;
  declare getBrightness: () => Promise<number>;

  declare setIsOn: (isOn: boolean) => Promise<void>;
  declare setIsOnState: (isOn: boolean) => Promise<void>;
  declare getIsOn: () => Promise<boolean>;
}