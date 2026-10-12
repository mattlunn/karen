import dayjs from '../../dayjs';
import { findCheapestWindow, PriceSlot } from '../../helpers/prices';

export type StoredRun = {
  start: string;
  end: string;
  finishBy: string;
  durationMinutes: number;
  // Beyond this, the plan was made against AgilePredict's forecast rather than published prices.
  publishedEnd: string | null;
};

export function planRun(slots: PriceSlot[], durationMinutes: number, finishBy: Date, now: Date): StoredRun {
  const window = findCheapestWindow(slots, durationMinutes, now, finishBy);

  if (window === null) {
    throw new Error(`There are no prices to plan a ${Math.round(durationMinutes)} minute run before ${dayjs(finishBy).format('HH:mm')}`);
  }

  return {
    start: window.start.toISOString(),
    end: dayjs(window.start).add(durationMinutes, 'minute').toISOString(),
    finishBy: finishBy.toISOString(),
    durationMinutes,
    publishedEnd: slots.findLast((slot) => !slot.isEstimated)?.end.toISOString() ?? null,
  };
}
