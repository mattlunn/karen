import { MotionSensorBaseCapability } from './capabilities.gen';

export class MotionSensorCapability extends MotionSensorBaseCapability {
  getPendingSensitivity(): number | null {
    return (this.device.meta.pendingSensitivity as number | undefined) ?? null;
  }
}
