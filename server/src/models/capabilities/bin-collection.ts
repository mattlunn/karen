import { BinCollectionBaseCapability } from './capabilities.gen';
import config from '../../config';
import dayjs, { Dayjs } from '../../dayjs';

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

function buildRruleString(anchorDate: string, intervalWeeks: number): string {
  const dtstart = anchorDate.replace(/-/g, '') + 'T000000';
  return `DTSTART:${dtstart}\nRRULE:FREQ=WEEKLY;INTERVAL=${intervalWeeks}`;
}

/**
 * Find the next occurrence of a fortnightly (or N-weekly) schedule on or after `after`.
 */
function getNextOccurrence(anchorDate: string, intervalWeeks: number, after: Dayjs): Dayjs {
  const anchor = dayjs(anchorDate);
  const diffDays = after.startOf('day').diff(anchor.startOf('day'), 'day');
  const periodDays = intervalWeeks * 7;

  if (diffDays <= 0) {
    return anchor;
  }

  const periodsPassed = Math.floor(diffDays / periodDays);
  let candidate = anchor.add(periodsPassed * periodDays, 'day');

  if (candidate.isBefore(after, 'day')) {
    candidate = candidate.add(periodDays, 'day');
  }

  return candidate;
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

    return {
      rrule: buildRruleString(bin.anchorDate, bin.intervalWeeks),
      exdates: bin.overrides.map(o => o.originalDate),
      overrides: bin.overrides,
    };
  }

  getNextCollectionDate(after: Date = new Date()): { date: Date; isOverride: boolean } | null {
    const bin = this.#getBinConfig();
    const afterDay = dayjs(after);

    // Override dates that fall on or after `after`
    const futureOverrides = bin.overrides
      .map(o => ({ date: dayjs(o.newDate), originalDate: o.originalDate }))
      .filter(o => o.date.isSameOrAfter(afterDay, 'day'));

    // Find next regular occurrence, skipping excluded dates
    const exdateSet = new Set(bin.overrides.map(o => o.originalDate));
    let nextRegular = getNextOccurrence(bin.anchorDate, bin.intervalWeeks, afterDay);

    // Skip up to 52 iterations to avoid infinite loop
    for (let i = 0; i < 52 && exdateSet.has(nextRegular.format('YYYY-MM-DD')); i++) {
      nextRegular = nextRegular.add(bin.intervalWeeks * 7, 'day');
    }

    // Find the earliest date among overrides and regular occurrences
    let earliest: { date: Dayjs; isOverride: boolean } | null = null;

    if (!exdateSet.has(nextRegular.format('YYYY-MM-DD'))) {
      earliest = { date: nextRegular, isOverride: false };
    }

    for (const override of futureOverrides) {
      if (!earliest || override.date.isBefore(earliest.date, 'day')) {
        earliest = { date: override.date, isOverride: true };
      }
    }

    return earliest ? { date: earliest.date.toDate(), isOverride: earliest.isOverride } : null;
  }

  getOverrideForOriginalDate(date: Date): string | null {
    const bin = this.#getBinConfig();
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const override = bin.overrides.find(o => o.originalDate === dateStr);

    return override?.newDate ?? null;
  }

  getOriginalDateForOverride(date: Date): string | null {
    const bin = this.#getBinConfig();
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const override = bin.overrides.find(o => o.newDate === dateStr);

    return override?.originalDate ?? null;
  }
}
