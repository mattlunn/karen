import { normalizeTime } from './time';
import dayjs from '../dayjs';

// A timer can fire exactly on its target instant (or a millisecond early), in which case
// isBefore(now) is false and rescheduling for "today" would produce a ~0ms timeout - re-firing
// func() a second time for the occurrence we just handled. Treat anything under this threshold
// as already elapsed so we always roll over to tomorrow instead.
const MINIMUM_DELAY_MS = 1000;

export default function(func, time) {
  function getMillisecondsToNextOccurenceOf(time) {
    const now = dayjs();
    const todaysOccurence = normalizeTime(time);
    const nextOccurence = todaysOccurence.diff(now) < MINIMUM_DELAY_MS
      ? normalizeTime(time, dayjs(now).startOf('day').add(1, 'd'))
      : todaysOccurence;

    return nextOccurence.valueOf() - now.valueOf();
  }

  (function setNextTimeout() {
    setTimeout(() => {
      setNextTimeout();
      func();
    }, getMillisecondsToNextOccurenceOf(time));
  }());
}