import bus, { FIRST_USER_HOME, LAST_USER_LEAVES } from '../bus';
import { Stay } from '../models';
import { isWithinTime } from '../helpers/time';
import setIntervalForTime from '../helpers/set-interval-for-time';

export default function (start, end, onStart, onEnd) {
  let isActive = false;
  
  setIntervalForTime(async () => {
    const isSomeoneAtHome = await Stay.checkIfSomeoneHomeAt(Date.now());

    if (isSomeoneAtHome) {
      isActive = true;
      await onStart();
    }
  }, start);

  setIntervalForTime(async () => {
    if (isActive) {
      isActive = false;
      await onEnd();
    }
  }, end);

  bus.on(FIRST_USER_HOME, async (event) => {
    if (isWithinTime(start, end, event.start) && !isActive) {
      isActive = true;
      await onStart();
    }
  });

  bus.on(LAST_USER_LEAVES, async (event) => {
    if (isWithinTime(start, end, event.start)) {
      isActive = false;
      await onEnd();
    }
  });
}