import dayjs from '../dayjs';
import { isOccurrenceDay } from './recurrence';
import { isWithinTime, normalizeTime } from './time';

export type SilencingWindow = {
  name: string;
  anchor_date: string;    // e.g. "2026-06-17" (a Wednesday)
  interval_weeks: number; // e.g. 2 for every other week
  start: string;          // e.g. "08:00" (also supports "sunrise"/"sunset")
  end: string;            // e.g. "12:00"
  overrides: { original_date: string; new_date: string }[];
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
