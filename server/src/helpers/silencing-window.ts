import dayjs, { Dayjs } from '../dayjs';
import { getNextOccurrence, isOccurrenceDay } from './recurrence';
import { isWithinTime, normalizeTime } from './time';

export type SilencingWindow = {
  name: string;
  anchor_date: string;    // e.g. "2026-06-17" (a Wednesday)
  interval_weeks: number; // e.g. 2 for every other week
  start: string;          // e.g. "08:00" (also supports "sunrise"/"sunset")
  end: string;            // e.g. "12:00"
  overrides: { original_date: string; new_date: string | null }[]; // new_date null cancels the occurrence
};

export type SilencingWindowOccurrence = {
  window: SilencingWindow;
  status: 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED';
  scheduledStart: Dayjs;
  scheduledEnd: Dayjs;
  start: Dayjs | null;
  end: Dayjs | null;
};

function isWindowDay(window: SilencingWindow, dateStr: string): boolean {
  if (window.overrides.some((override) => override.new_date === dateStr)) {
    return true;
  }

  if (window.overrides.some((override) => override.original_date === dateStr)) {
    return false;
  }

  return isOccurrenceDay(window.anchor_date, window.interval_weeks, dateStr);
}

export function findActiveSilencingWindow(windows: SilencingWindow[], when: Date): SilencingWindow | undefined {
  const dateStr = dayjs(when).format('YYYY-MM-DD');

  return windows.find((window) => {
    return isWindowDay(window, dateStr) && isWithinTime(window.start, window.end, when);
  });
}

export function getSilencingWindowEndsAt(window: SilencingWindow, when: Date): Date {
  return normalizeTime(window.end, when).toDate();
}

function buildOccurrence(window: SilencingWindow, scheduledDate: string, date: string | null): SilencingWindowOccurrence {
  const slot = (dateStr: string) => {
    const day = dayjs(dateStr).toDate();

    return { start: normalizeTime(window.start, day), end: normalizeTime(window.end, day) };
  };

  const scheduled = slot(scheduledDate);
  const actual = date === null ? null : slot(date);

  return {
    window,
    status: date === null ? 'CANCELLED' : date === scheduledDate ? 'SCHEDULED' : 'RESCHEDULED',
    scheduledStart: scheduled.start,
    scheduledEnd: scheduled.end,
    start: actual?.start ?? null,
    end: actual?.end ?? null
  };
}

function getUnfinishedOccurrences(window: SilencingWindow, now: Date): SilencingWindowOccurrence[] {
  const overriddenDates = new Set(window.overrides.map((override) => override.original_date));
  const occurrences = window.overrides.map((override) => buildOccurrence(window, override.original_date, override.new_date));

  // Overrides can only displace a finite number of regular occurrences, so this always finds one.
  for (let date = getNextOccurrence(window.anchor_date, window.interval_weeks, dayjs(now)); ; date = date.add(window.interval_weeks, 'week')) {
    const dateStr = date.format('YYYY-MM-DD');

    if (!overriddenDates.has(dateStr)) {
      const occurrence = buildOccurrence(window, dateStr, dateStr);

      occurrences.push(occurrence);

      if (occurrence.end!.isAfter(now)) {
        break;
      }
    }
  }

  return occurrences.filter((occurrence) => (occurrence.end ?? occurrence.scheduledEnd).isAfter(now));
}

export function getUpcomingSilencingWindowOccurrences(windows: SilencingWindow[], now: Date): SilencingWindowOccurrence[] {
  const occurrences = windows
    .flatMap((window) => getUnfinishedOccurrences(window, now))
    .sort((a, b) => (a.start ?? a.scheduledStart).diff(b.start ?? b.scheduledStart));

  const firstUncancelled = occurrences.findIndex((occurrence) => occurrence.status !== 'CANCELLED');

  return occurrences.slice(0, firstUncancelled + 1);
}
