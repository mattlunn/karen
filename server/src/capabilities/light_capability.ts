import { Device } from '../models';
import { numericProperty, booleanProperty } from './helpers';

@numericProperty('Brightness', { dbName: 'brightness', writeable: true })
@booleanProperty('IsOn', { dbName: 'on', writeable: true })
export class LightCapability {
  device: Device;
  handlers: Pick<LightCapability, 'setBrightness' | 'setIsOn'>;

  constructor(device: Device) {
    this.device = device;
    
    const provider = Device._providers.get(device.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${device.provider} does not exist for device ${device.id} (${device.name})`);
    }

    const handler = provider.getLightCapability;

    if (handler === undefined) {
      throw new Error(`Provider ${device.provider} does not support LightCapability`);
    }

    this.handlers = handler(device);
  }

  declare setBrightness: (brightness: number) => Promise<void>;
  declare setIsOn: (isOn: boolean) => Promise<void>;
}