import { BinCollectionBaseCapability } from './capabilities.gen';
import config from '../../config';
import dayjs, { Dayjs } from '../../dayjs';

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

function buildRruleString(anchorDate: string, intervalWeeks: number): string {
  const dtstart = anchorDate.replace(/-/g, '') + 'T000000';
  return `DTSTART:${dtstart}\nRRULE:FREQ=WEEKLY;INTERVAL=${intervalWeeks}`;
}

function isCollectionDay(anchorDate: string, intervalWeeks: number, dateStr: string): boolean {
  const anchor = dayjs(anchorDate).startOf('day');
  const date = dayjs(dateStr).startOf('day');
  const diffDays = date.diff(anchor, 'day');
  const periodDays = intervalWeeks * 7;

  return diffDays >= 0 && diffDays % periodDays === 0;
}

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
      isCollectionDay(bin.anchorDate, bin.intervalWeeks, o.originalDate)
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

    // Override dates that fall on or after `after`
    const futureOverrides = overrides
      .map(o => ({ date: dayjs(o.newDate), originalDate: o.originalDate }))
      .filter(o => o.date.isSameOrAfter(afterDay, 'day'));

    // Find next regular occurrence, skipping excluded dates
    const exdateSet = new Set(overrides.map(o => o.originalDate));
    let nextRegular = getNextOccurrence(bin.anchorDate, bin.intervalWeeks, afterDay);

    for (let i = 0; i < 52 && exdateSet.has(nextRegular.format('YYYY-MM-DD')); i++) {
      nextRegular = nextRegular.add(bin.intervalWeeks * 7, 'day');
    }

    let earliest: { date: Dayjs; isOverride: boolean } = { date: nextRegular, isOverride: false };

    for (const override of futureOverrides) {
      if (override.date.isBefore(earliest.date, 'day')) {
        earliest = { date: override.date, isOverride: true };
      }
    }

    return { date: earliest.date.toDate(), isOverride: earliest.isOverride };
  }

  getOverrideForOriginalDate(date: Date): string | null {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const overrides = this.#getRelevantOverrides();
    const override = overrides.find(o => o.originalDate === dateStr);

    return override?.newDate ?? null;
  }

}
