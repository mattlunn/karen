import { Device } from '../models';

export class SpeakerCapability {
  #handlers: Pick<SpeakerCapability, 'emitSound'>;

  constructor(device: Device) {
    const provider = Device._providers.get(device.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${device.provider} does not exist for device ${device.id} (${device.name})`);
    }

    const handler = provider.getSpeakerCapability;

    if (handler === undefined) {
      throw new Error(`Provider ${device.provider} does not support LightCapability`);
    }

    this.#handlers = handler(device);
  }

  async emitSound(sound: string | string[]): Promise<void> {
    return this.#handlers.emitSound(sound);
  }
}