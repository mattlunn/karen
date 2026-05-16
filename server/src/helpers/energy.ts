import { NumericEvent } from '../models';
import dayjs from '../dayjs';

/**
 * Integrates a series of power events (Watts) over time, returning watt-hours.
 */
export function calculateWattHours(events: NumericEvent[]): number {
  return Math.round(100 * events.reduce((acc, curr) => {
    const minutes = dayjs(curr.end).diff(curr.start, 'minute');
    return acc + (curr.value * minutes);
  }, 0) / 60) / 100;
}
