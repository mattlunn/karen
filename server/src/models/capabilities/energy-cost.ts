import { EnergyCostBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { PriceSlot, toPriceSlots, startOfSlot } from '../../helpers/prices';

export class EnergyCostCapability extends EnergyCostBaseCapability {
  // Splices forecast slots on past the published frontier (~31h ahead on
  // Agile), flagged `isEstimated` - callers that must only act on settled
  // prices filter them out.
  async getForwardUnitRates(until: Date): Promise<PriceSlot[]> {
    // Aligned to the slot boundary rather than `now`, so a caller starting
    // mid-slot can still take the rest of the slot it lands in: `toPriceSlots`
    // drops a partial at the edge, and that slot is often the day's cheapest.
    const since = startOfSlot(new Date());
    const settled = toPriceSlots(await this.getUnitRateHistory({ since, until }), since, until);
    const frontier = settled.at(-1)?.end ?? since;

    if (frontier >= until) {
      return settled;
    }

    const forecast = await Device.getProviderCapabilities(this.device.provider)
      .provideEnergyCostCapability!()
      .getForecastSlots(this.device, frontier, until);

    return [...settled, ...forecast];
  }
}
