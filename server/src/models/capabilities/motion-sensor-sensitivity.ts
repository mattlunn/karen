import { MotionSensorSensitivityBaseCapability } from './capabilities.gen';
import { Device } from '..';

export class MotionSensorSensitivityCapability extends MotionSensorSensitivityBaseCapability {
  getPendingSensitivity(): number | null {
    return Device.getProviderCapabilities(this.device.provider)
      .provideMotionSensorSensitivityCapability!()
      .getPendingSensitivity(this.device);
  }
}
