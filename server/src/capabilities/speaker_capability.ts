import { Capability } from '.';
import { Device } from '../models';

export type SpeakerCapabilityProviderHandlers = 'emitSound';

export class SpeakerCapability extends Capability<SpeakerCapability, SpeakerCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, Device.getProviderOrThrow(device.provider)!.getSpeakerCapability);
  }

  async emitSound(sound: string | string[]): Promise<void> {
    return this.handlers.emitSound(sound);
  }
}