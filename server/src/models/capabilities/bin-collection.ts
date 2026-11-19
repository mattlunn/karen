import { BinCollectionBaseCapability } from './capabilities.gen';
import config from '../../config';
import dayjs from '../../dayjs';
import { buildRruleString, isOccurrenceDay, getNextOccurrenceWithOverrides } from '../../helpers/recurrence';

interface BinItemConfig {
  id: string;
  name: string;
  color: string;
  anchorDate: string;
  intervalWeeks: number;
}

interface Override {
  originalDate: string;
  newDate: string;
}

export interface BinScheduleData {
  rrule: string;
  exdates: string[];
  overrides: Override[];
}

export class BinCollectionCapability extends BinCollectionBaseCapability {
  #getBinItem(): BinItemConfig {
    const bin = config.bins.items.find(b => b.id === this.device.providerId);

    if (!bin) {
      throw new Error(`No bin config for providerId ${this.device.providerId}`);
    }

    return bin;
  }

  #getRelevantOverrides(): Override[] {
    const bin = this.#getBinItem();
    return config.bins.overrides.filter(o =>
      isOccurrenceDay(bin.anchorDate, bin.intervalWeeks, o.originalDate)
    );
  }

  getColor(): string {
    return this.#getBinItem().color;
  }

  getScheduleData(): BinScheduleData {
    const bin = this.#getBinItem();
    const overrides = this.#getRelevantOverrides();

    return {
      rrule: buildRruleString(bin.anchorDate, bin.intervalWeeks),
      exdates: overrides.map(o => o.originalDate),
      overrides,
    };
  }

  getNextCollectionDate(after: Date = new Date()): { date: Date; isOverride: boolean } {
    const bin = this.#getBinItem();
    const next = getNextOccurrenceWithOverrides(bin.anchorDate, bin.intervalWeeks, this.#getRelevantOverrides(), dayjs(after));

    return { date: dayjs(next.date).toDate(), isOverride: next.date !== next.scheduledDate };
  }

  getOverrideForOriginalDate(date: Date): string | null {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const overrides = this.#getRelevantOverrides();
    const override = overrides.find(o => o.originalDate === dateStr);

    return override?.newDate ?? null;
  }

}
