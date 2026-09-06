import { normalizeTime } from './time';
import dayjs from '../dayjs';

// dayjs' add()/set() operate on the fixed UTC offset already baked into an already-normalized
// target, rather than re-deriving the correct Europe/London offset for the resulting date - so
// naively adding a day can land an hour off (or even roll onto the wrong calendar date,
// depending on the direction) across a DST transition. Advance the calendar date in UTC (where
// day/month/year arithmetic is unambiguous - no DST there) and re-normalize the time fresh via
// normalizeTime, the same way normalizeTime resolves a date/time pair for any other date.
function advanceByOneDay(target, time) {
  const tomorrow = dayjs.utc(target.format('YYYY-MM-DD')).add(1, 'day').toDate();

  return normalizeTime(time, tomorrow);
}

export default function scheduleDaily(func, time) {
  // Only the very first occurrence needs to be resolved against "now" - if today's time has
  // already passed, start from tomorrow instead. Every occurrence after that is simply the
  // previous target advanced by a day, so it's always in the future by construction - never
  // recomputed against "now", which is what let a timer firing exactly on its target instant
  // reschedule itself with a ~0ms delay and double-fire.
  let target = normalizeTime(time);

  if (target.isBefore(dayjs())) {
    target = advanceByOneDay(target, time);
  }

  (function scheduleNext() {
    setTimeout(() => {
      target = advanceByOneDay(target, time);

      scheduleNext();
      func();
    }, target.diff(dayjs()));
  }());
}
