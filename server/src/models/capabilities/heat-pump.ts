import { HeatPumpBaseCapability, HeatPumpDHWMode } from './capabilities.gen';
import { Device } from '..';
import { DHWPlannedWindow } from './index';

export class HeatPumpCapability extends HeatPumpBaseCapability {
  // getStringProperty defaults an unwritten enum to '', so coalesce to OFF -
  // the safe resting state before the user has ever touched the control.
  async getDHWMode(): Promise<HeatPumpDHWMode> {
    return (await super.getDHWMode()) === 'AUTO' ? 'AUTO' : 'OFF';
  }

  getPlannedDHWWindow(): DHWPlannedWindow | null {
    return Device.getProviderCapabilities(this.device.provider)
      .provideHeatPumpCapability!()
      .getPlannedDHWWindow(this.device);
  }
}
