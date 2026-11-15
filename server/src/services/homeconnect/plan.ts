import dayjs from '../../dayjs';
import { findCheapestWindow, startOfSlot, PriceSlot, SLOT_MINUTES } from '../../helpers/prices';

export type StoredRun = {
  start: string;
  end: string;
  finishBy: string;
};

// Starting now is priced as the slot already under way, and is also the fallback when no later start
// can finish by the deadline.
export function planRun(slots: PriceSlot[], durationMinutes: number, powerProfileKwh: number[], finishBy: Date, now: Date): StoredRun {
  const windowMinutes = Math.ceil(durationMinutes / SLOT_MINUTES) * SLOT_MINUTES;
  const latestStart = dayjs(finishBy).subtract(durationMinutes, 'minute');
  const currentSlot = startOfSlot(now);
  const startNow = findCheapestWindow(slots, durationMinutes, currentSlot, dayjs(currentSlot).add(windowMinutes, 'minute').toDate(), powerProfileKwh);
  const later = findCheapestWindow(slots, durationMinutes, now, latestStart.add(windowMinutes, 'minute').toDate(), powerProfileKwh);
  const start = later !== null && (startNow === null || later.averagePence < startNow.averagePence) ? later.start : now;

  return {
    start: start.toISOString(),
    end: dayjs(start).add(durationMinutes, 'minute').toISOString(),
    finishBy: finishBy.toISOString(),
  };
}
