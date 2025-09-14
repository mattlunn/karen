import { Device } from '../device';

export class SpeakerCapability {
  constructor(device: Device) {
    this.#device = device;
  }

  #device: Device;
  
  emitSound(sound: string | string[], ttlInSeconds?: number): Promise<void> {
    return Device.getProviderCapabilities(this.#device.provider).provideSpeakerCapability!().emitSound(this.#device, sound, ttlInSeconds);
  }
}