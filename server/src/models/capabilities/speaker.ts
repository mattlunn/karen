import { Device } from '../device';
import { SpeakerBaseCapability } from './capabilities.gen';

export class SpeakerCapability extends SpeakerBaseCapability {
  emitSound(sound: string | string[], ttlInSeconds?: number): Promise<void> {
    return Device.getProviderCapabilities(this.device.provider).provideSpeakerCapability!().emitSound(this.device, sound, ttlInSeconds);
  }
}