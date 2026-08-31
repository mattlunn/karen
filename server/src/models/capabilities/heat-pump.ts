import { HeatPumpBaseCapability, HeatPumpHotWaterMode } from './capabilities.gen';
import { Device } from '..';
import { DHWPlannedWindow } from './index';

export class HeatPumpCapability extends HeatPumpBaseCapability {
  #provider() {
    return Device.getProviderCapabilities(this.device.provider).provideHeatPumpCapability!();
  }

  async getDHWMode(): Promise<HeatPumpHotWaterMode> {
    return (await this.getHotWaterMode()) === 'AUTO' ? 'AUTO' : 'OFF';
  }

  setDHWMode(mode: HeatPumpHotWaterMode): Promise<void> {
    return this.#provider().setDHWMode(this.device, mode);
  }

  setDHWBoost(on: boolean): Promise<void> {
    return this.#provider().setDHWBoost(this.device, on);
  }

  getPlannedDHWWindow(): DHWPlannedWindow | null {
    return this.#provider().getPlannedDHWWindow(this.device);
  }
}
