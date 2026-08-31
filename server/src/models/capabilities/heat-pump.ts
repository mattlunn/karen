import { HeatPumpBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { DHWPlannedWindow } from './index';

export class HeatPumpCapability extends HeatPumpBaseCapability {
  getPlannedDHWWindow(): DHWPlannedWindow | null {
    return Device.getProviderCapabilities(this.device.provider)
      .provideHeatPumpCapability!()
      .getPlannedDHWWindow(this.device);
  }
}
