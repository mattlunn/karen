import dayjs, { Dayjs } from '../dayjs';

export function buildRruleString(anchorDate: string, intervalWeeks: number): string {
  const dtstart = anchorDate.replace(/-/g, '') + 'T000000';
  return `DTSTART:${dtstart}\nRRULE:FREQ=WEEKLY;INTERVAL=${intervalWeeks}`;
}

export function isOccurrenceDay(anchorDate: string, intervalWeeks: number, dateStr: string): boolean {
  const anchor = dayjs(anchorDate).startOf('day');
  const date = dayjs(dateStr).startOf('day');
  const diffDays = date.diff(anchor, 'day');
  const periodDays = intervalWeeks * 7;

  return diffDays >= 0 && diffDays % periodDays === 0;
}

export function getNextOccurrence(anchorDate: string, intervalWeeks: number, after: Dayjs): Dayjs {
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

export type DateOverride = { originalDate: string; newDate: string | null }; // newDate null cancels the occurrence

export type Occurrence = { scheduledDate: string; date: string | null };

function effectiveDate(occurrence: Occurrence): string {
  return occurrence.date ?? occurrence.scheduledDate;
}

export function isOccurrenceDayWithOverrides(anchorDate: string, intervalWeeks: number, overrides: DateOverride[], dateStr: string): boolean {
  if (overrides.some((override) => override.newDate === dateStr)) {
    return true;
  }

  if (overrides.some((override) => override.originalDate === dateStr)) {
    return false;
  }

  return isOccurrenceDay(anchorDate, intervalWeeks, dateStr);
}

// Endless, in the order the occurrences happen; a cancelled one is placed at its scheduled date.
export function* iterateOccurrencesWithOverrides(anchorDate: string, intervalWeeks: number, overrides: DateOverride[], from: Dayjs): Generator<Occurrence, never> {
  const fromStr = from.format('YYYY-MM-DD');
  const overriddenDates = new Set(overrides.map((override) => override.originalDate));
  const pendingOverrides = overrides
    .map((override) => ({ scheduledDate: override.originalDate, date: override.newDate }))
    .filter((occurrence) => effectiveDate(occurrence) >= fromStr)
    .sort((a, b) => effectiveDate(a).localeCompare(effectiveDate(b)));

  for (let regular = getNextOccurrence(anchorDate, intervalWeeks, from); ; regular = regular.add(intervalWeeks, 'week')) {
    const regularStr = regular.format('YYYY-MM-DD');

    if (!overriddenDates.has(regularStr)) {
      while (pendingOverrides.length > 0 && effectiveDate(pendingOverrides[0]) <= regularStr) {
        yield pendingOverrides.shift()!;
      }

      yield { scheduledDate: regularStr, date: regularStr };
    }
  }
}

export function getNextOccurrenceWithOverrides(anchorDate: string, intervalWeeks: number, overrides: DateOverride[], from: Dayjs): { scheduledDate: string; date: string } {
  const occurrences = iterateOccurrencesWithOverrides(anchorDate, intervalWeeks, overrides, from);

  while (true) {
    const { scheduledDate, date } = occurrences.next().value;

    if (date !== null) {
      return { scheduledDate, date };
    }
  }
}
