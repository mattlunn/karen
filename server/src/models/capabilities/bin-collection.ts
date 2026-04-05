import { BinCollectionBaseCapability } from './capabilities.gen';
import config from '../../config';
import { RRule } from 'rrule';
import dayjs from '../../dayjs';

interface BinConfig {
  id: string;
  name: string;
  color: string;
  anchorDate: string;
  intervalWeeks: number;
  overrides: Array<{ originalDate: string; newDate: string }>;
}

export interface BinScheduleData {
  rrule: string;
  exdates: string[];
  overrides: Array<{ originalDate: string; newDate: string }>;
}

export class BinCollectionCapability extends BinCollectionBaseCapability {
  #getBinConfig(): BinConfig {
    const bins = (config as unknown as { bins: BinConfig[] }).bins;
    const bin = bins.find(b => b.id === this.device.providerId);

    if (!bin) {
      throw new Error(`No bin config for providerId ${this.device.providerId}`);
    }

    return bin;
  }

  getColor(): string {
    return this.#getBinConfig().color;
  }

  getScheduleData(): BinScheduleData {
    const bin = this.#getBinConfig();

    const rrule = new RRule({
      freq: RRule.WEEKLY,
      interval: bin.intervalWeeks,
      dtstart: new Date(bin.anchorDate + 'T00:00:00'),
    });

    return {
      rrule: rrule.toString(),
      exdates: bin.overrides.map(o => o.originalDate),
      overrides: bin.overrides,
    };
  }

  getNextCollectionDate(after: Date = new Date()): { date: Date; isOverride: boolean } | null {
    const bin = this.#getBinConfig();

    const rrule = new RRule({
      freq: RRule.WEEKLY,
      interval: bin.intervalWeeks,
      dtstart: new Date(bin.anchorDate + 'T00:00:00'),
    });

    // Check overrides that fall after the given date
    const overrideDates = bin.overrides
      .map(o => ({ date: new Date(o.newDate + 'T00:00:00'), originalDate: o.originalDate }))
      .filter(o => dayjs(o.date).isSameOrAfter(dayjs(after), 'day'));

    // Get next rrule occurrence, skipping excluded dates
    const exdateSet = new Set(bin.overrides.map(o => o.originalDate));
    let nextRegular: Date | null = rrule.after(dayjs(after).subtract(1, 'day').endOf('day').toDate(), false);

    while (nextRegular && exdateSet.has(dayjs(nextRegular).format('YYYY-MM-DD'))) {
      nextRegular = rrule.after(nextRegular, false);
    }

    // Find the earliest date among overrides and regular occurrences
    let earliest: { date: Date; isOverride: boolean } | null = null;

    if (nextRegular) {
      earliest = { date: nextRegular, isOverride: false };
    }

    for (const override of overrideDates) {
      if (!earliest || override.date < earliest.date) {
        earliest = { date: override.date, isOverride: true };
      }
    }

    return earliest;
  }

  /**
   * If `date` was supposed to be a regular collection day but was overridden,
   * returns the new date it was moved to. Otherwise returns null.
   */
  getOverrideForOriginalDate(date: Date): string | null {
    const bin = this.#getBinConfig();
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const override = bin.overrides.find(o => o.originalDate === dateStr);

    return override?.newDate ?? null;
  }

  /**
   * If `date` is an override collection date, returns the original date it was moved from.
   */
  getOriginalDateForOverride(date: Date): string | null {
    const bin = this.#getBinConfig();
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const override = bin.overrides.find(o => o.newDate === dateStr);

    return override?.originalDate ?? null;
  }
}
