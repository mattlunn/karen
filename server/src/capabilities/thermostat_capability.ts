import { Device } from '../models';
import { numericProperty, booleanProperty } from './helpers';

@numericProperty('CurrentTemperature', { dbName: 'temperature' })
@numericProperty('TargetTemperature', { dbName: 'target', writeable: true })
@numericProperty('Power', { dbName: 'power' })
@booleanProperty('IsOn', { dbName: 'heating', writeable: true })
export class ThermostatCapability {
  #device: Device;
  #handlers: Pick<ThermostatCapability, 'setTargetTemperature' | 'setIsOn'>;

  constructor(device: Device) {
    this.#device = device;
    
    const provider = Device._providers.get(device.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${device.provider} does not exist for device ${device.id} (${device.name})`);
    }

    const handler = provider.getThermostatCapability;

    if (handler === undefined) {
      throw new Error(`Provider ${device.provider} does not support LightCapability`);
    }

    this.#handlers = handler(device);
  }

  declare setTargetTemperature: (targetTemperature: number, signal?: AbortSignal) => Promise<void>;
  declare setIsOn: (isOn: boolean, signal?: AbortSignal) => Promise<void>;
}