import { BinCollectionBaseCapability } from './capabilities.gen';
import config from '../../config/app';
import dayjs from '../../dayjs';
import { buildRruleString, isOccurrenceDay, getNextOccurrence } from '../../helpers/recurrence';

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
    const afterDay = dayjs(after);
    const overrides = this.#getRelevantOverrides();

    // Find the next regular occurrence that hasn't been overridden
    const exdateSet = new Set(overrides.map(o => o.originalDate));
    let nextRegular = getNextOccurrence(bin.anchorDate, bin.intervalWeeks, afterDay);

    while (exdateSet.has(nextRegular.format('YYYY-MM-DD'))) {
      nextRegular = nextRegular.add(bin.intervalWeeks * 7, 'day');
    }

    // Check if there's an override date that comes sooner
    const soonestOverride = overrides
      .map(o => dayjs(o.newDate))
      .filter(d => d.isSameOrAfter(afterDay, 'day'))
      .sort((a, b) => a.diff(b))[0];

    return soonestOverride && soonestOverride.isBefore(nextRegular, 'day')
      ? { date: soonestOverride.toDate(), isOverride: true }
      : { date: nextRegular.toDate(), isOverride: false };
  }

  getOverrideForOriginalDate(date: Date): string | null {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const overrides = this.#getRelevantOverrides();
    const override = overrides.find(o => o.originalDate === dateStr);

    return override?.newDate ?? null;
  }

}
