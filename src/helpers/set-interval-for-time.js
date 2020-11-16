import { normalizeTime } from './time';
import moment from 'moment';

export default function(func, time) {
  function getMillisecondsToNextOccurenceOf(time) {
    const now = moment();
    const todaysOccurence = normalizeTime(time);
    const nextOccurence = todaysOccurence.isBefore(now)
      ? normalizeTime(time, moment(now).startOf('day').add(1, 'd'))
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