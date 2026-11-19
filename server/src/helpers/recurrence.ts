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
