import { z } from 'zod';

// Mirrors what `normalizeTime` (helpers/time.js) actually accepts: a "HH:MM" wall-clock time or
// "sunrise"/"sunset", optionally followed by a signed offset such as "+ 30m" or "- 1h30m".
//
// Worth validating rather than trusting, because both failure modes are silent until the
// automation fires: a malformed base ("9.30") throws from deep inside dayjs at that moment, and
// an out-of-range one ("25:00") is quietly accepted as 01:00 the following day.
const TIME_PATTERN = /^(sunrise|sunset|([01]?\d|2[0-3]):[0-5]\d)( *[+-] *(\d+ *[a-zA-Z]+)+)?$/;

export const timeString = z.string().regex(
  TIME_PATTERN,
  'must be "HH:MM", "sunrise" or "sunset", optionally followed by an offset such as "+ 30m"'
);

// A start/end pair is the shape most of the scheduling automations take.
export const timeRange = z.object({
  start: timeString,
  end: timeString
});
