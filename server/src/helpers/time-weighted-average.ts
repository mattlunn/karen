import type { NumericEvent } from '../models';
import dayjs from '../dayjs';

export function timeWeightedAverage(events: Pick<NumericEvent, 'value' | 'start' | 'end'>[], since: Date, until: Date): number | null {
  let weightedSum = 0;
  let totalDuration = 0;

  for (const event of events) {
    const start = event.start > since ? event.start : since;
    const end = event.end === null || event.end > until ? until : event.end;
    const duration = dayjs(end).diff(start);

    if (duration > 0) {
      weightedSum += event.value * duration;
      totalDuration += duration;
    }
  }

  return totalDuration === 0 ? null : weightedSum / totalDuration;
}
