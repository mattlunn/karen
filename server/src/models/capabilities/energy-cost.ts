import { EnergyCostBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { PriceSlot } from '../../helpers/prices';

export class EnergyCostCapability extends EnergyCostBaseCapability {
  getForecastSlots(since: Date, until: Date): Promise<PriceSlot[]> {
    return Device.getProviderCapabilities(this.device.provider)
      .provideEnergyCostCapability!()
      .getForecastSlots(this.device, since, until);
  }
}
