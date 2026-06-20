import dayjs from '../dayjs';
import { isOccurrenceDay } from './recurrence';
import { isWithinTime } from './time';

export type SilencingWindow = {
  name: string;
  anchor_date: string;    // e.g. "2026-06-17" (a Wednesday)
  interval_weeks: number; // e.g. 2 for every other week
  start: string;          // e.g. "08:00" (also supports "sunrise"/"sunset")
  end: string;            // e.g. "12:00"
};

export function findActiveSilencingWindow(windows: SilencingWindow[], when: Date): SilencingWindow | undefined {
  const dateStr = dayjs(when).format('YYYY-MM-DD');

  return windows.find((window) => {
    return isOccurrenceDay(window.anchor_date, window.interval_weeks, dateStr)
      && isWithinTime(window.start, window.end, when);
  });
}
