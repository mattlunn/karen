import { normalizeTime } from './time';
import { dayjs } from '../dayjs';

export default function(func, time) {
  function getMillisecondsToNextOccurenceOf(time) {
    const now = dayjs();
    const todaysOccurence = normalizeTime(time);
    const nextOccurence = todaysOccurence.isBefore(now)
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