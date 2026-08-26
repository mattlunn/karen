import { z } from 'zod';
import dayjs from '../dayjs';
import { isOccurrenceDay } from './recurrence';
import { isWithinTime, normalizeTime } from './time';
import { timeString } from '../automations/schema';

export const silencingWindow = z.object({
  name: z.string(),
  anchor_date: z.iso.date(),   // e.g. "2026-06-17" (a Wednesday)
  interval_weeks: z.int().positive(), // e.g. 2 for every other week
  start: timeString,           // e.g. "08:00" (also supports "sunrise"/"sunset")
  end: timeString              // e.g. "12:00"
});

export type SilencingWindow = z.infer<typeof silencingWindow>;

export function findActiveSilencingWindow(windows: SilencingWindow[], when: Date): SilencingWindow | undefined {
  const dateStr = dayjs(when).format('YYYY-MM-DD');

  return windows.find((window) => {
    return isOccurrenceDay(window.anchor_date, window.interval_weeks, dateStr)
      && isWithinTime(window.start, window.end, when);
  });
}

export function getSilencingWindowEndsAt(window: SilencingWindow, when: Date): Date {
  return normalizeTime(window.end, when).toDate();
}
