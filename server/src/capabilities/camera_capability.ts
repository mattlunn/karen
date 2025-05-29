import { Capability } from ".";
import { Device } from "../models";

export type CameraCapabilityProviderHandlers = never;

export class CameraCapability extends Capability<CameraCapability, CameraCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, undefined);
  }
}