import { Device } from '../models';
import { booleanProperty } from './helpers';

@booleanProperty('IsOn', { dbName: 'on' })
export class SwitchCapability {
  device: Device;
  handlers: Pick<SwitchCapability, 'setIsOn'>;

  constructor(device: Device) {
    this.device = device;
    
    const provider = Device._providers.get(device.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${device.provider} does not exist for device ${device.id} (${device.name})`);
    }

    const handler = provider.getSwitchCapability;

    if (handler === undefined) {
      throw new Error(`Provider ${device.provider} does not support LightCapability`);
    }

    this.handlers = handler(device);
  }

  declare setIsOn: (isOn: boolean, signal?: AbortSignal) => Promise<void>;
}