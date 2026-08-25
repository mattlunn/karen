import { normalizeTime } from './time';
import dayjs from '../dayjs';

export default function(func, time) {
  // Only the very first occurrence needs to be resolved against "now" - if today's time has
  // already passed, start from tomorrow instead. Every occurrence after that is simply the
  // previous target plus a day, so it's always in the future by construction - never recomputed
  // against "now", which is what let a timer firing exactly on its target instant reschedule
  // itself with a ~0ms delay and double-fire.
  let target = normalizeTime(time);

  if (target.isBefore(dayjs())) {
    target = target.add(1, 'day');
  }

  (function scheduleNext() {
    setTimeout(() => {
      target = target.add(1, 'day');

      scheduleNext();
      func();
    }, target.diff(dayjs()));
  }());
}
