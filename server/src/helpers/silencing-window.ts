import dayjs, { Dayjs } from '../dayjs';
import { DateOverride, isOccurrenceDayWithOverrides, iterateOccurrencesWithOverrides } from './recurrence';
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

function toDateOverrides(window: SilencingWindow): DateOverride[] {
  return window.overrides.map((override) => ({ originalDate: override.original_date, newDate: override.new_date }));
}

export function findActiveSilencingWindow(windows: SilencingWindow[], when: Date): SilencingWindow | undefined {
  const dateStr = dayjs(when).format('YYYY-MM-DD');

  return windows.find((window) => {
    return isOccurrenceDayWithOverrides(window.anchor_date, window.interval_weeks, toDateOverrides(window), dateStr) && isWithinTime(window.start, window.end, when);
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

// Through to the first one that isn't cancelled.
function getUnfinishedOccurrences(window: SilencingWindow, now: Date): SilencingWindowOccurrence[] {
  const unfinished: SilencingWindowOccurrence[] = [];
  const occurrences = iterateOccurrencesWithOverrides(window.anchor_date, window.interval_weeks, toDateOverrides(window), dayjs(now));

  while (true) {
    const { scheduledDate, date } = occurrences.next().value;
    const occurrence = buildOccurrence(window, scheduledDate, date);

    if ((occurrence.end ?? occurrence.scheduledEnd).isAfter(now)) {
      unfinished.push(occurrence);

      if (occurrence.status !== 'CANCELLED') {
        return unfinished;
      }
    }
  }
}

export function getUpcomingSilencingWindowOccurrences(windows: SilencingWindow[], now: Date): SilencingWindowOccurrence[] {
  const occurrences = windows
    .flatMap((window) => getUnfinishedOccurrences(window, now))
    .sort((a, b) => (a.start ?? a.scheduledStart).diff(b.start ?? b.scheduledStart));

  const firstUncancelled = occurrences.findIndex((occurrence) => occurrence.status !== 'CANCELLED');

  return occurrences.slice(0, firstUncancelled + 1);
}
