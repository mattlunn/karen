import { MotionSensorSensitivityBaseCapability } from './capabilities.gen';

export class MotionSensorSensitivityCapability extends MotionSensorSensitivityBaseCapability {
  getPendingSensitivity(): number | null {
    return (this.device.meta.pendingSensitivity as number | undefined) ?? null;
  }
}
