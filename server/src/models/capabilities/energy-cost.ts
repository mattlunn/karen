import { EnergyCostBaseCapability } from './capabilities.gen';
import { HistorySelector } from './helpers';
import { NumericEvent } from '..';

export class EnergyCostCapability extends EnergyCostBaseCapability {
  getUnitPrices(selection: HistorySelector): Promise<NumericEvent[]> {
    return this.getUnitRateHistory(selection);
  }

  async getRateAtTime(date: Date): Promise<number | null> {
    const rates = await this.getUnitRateHistory({ since: date, until: new Date(date.getTime() + 1) });
    const covering = rates.find(rate => rate.start <= date && (rate.end === null || rate.end > date));

    return covering?.value ?? null;
  }
}
