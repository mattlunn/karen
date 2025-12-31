import { BooleanEvent, NumericEvent } from "../models";
import { TimeRangeSelector } from "../models/capabilities/helpers";


export function clampAndSortHistory(history: NumericEvent[], selector: TimeRangeSelector, expectGaps: false): NumericEvent[];
export function clampAndSortHistory(history: BooleanEvent[], selector: TimeRangeSelector, expectGaps: true): BooleanEvent[];
export function clampAndSortHistory<T extends NumericEvent | BooleanEvent>(history: T[], selector: TimeRangeSelector, expectGaps: boolean): T[] {
  if (history.length === 0) {
    return history;
  }

  const sortedHistory = history.toSorted((a, b) => {
    return a.start.valueOf() - b.start.valueOf();
  });

  // Fix data issues where some events never get ended, leaving multiple "open" events.
  // We "patch" these, by forcing the end to be the start of the next event.
  for (let i=0;i<sortedHistory.length - 1;i++) {
    const currentItem = sortedHistory[i];
    const nextItem = sortedHistory[i+1];

    if (currentItem.end === null) {
      currentItem.end = nextItem.start;
    }

    if (!expectGaps && currentItem.end.getTime() !== nextItem.start.getTime()) {
      currentItem.end = nextItem.start;
    } else if (currentItem.end > nextItem.start) {
      currentItem.end = nextItem.start;
    }
  }

  // If the last event is ongoing, set its end to the end of the window requested.
  if (sortedHistory.at(-1)!.end === null) {
    sortedHistory.at(-1)!.end = selector.until;
  }

  // Having fixed the above, we can end up in scenarios where there were multiple open events
  // prior to the time range selected, so we now have a number of events at the start of the
  // array which aren't for the time period requested.
  while (sortedHistory[0].start < selector.since && sortedHistory[0].end! < selector.since) {
    sortedHistory.shift();
  }

  // If the first event starts before the start of the window, clamp it to the start.
  if (sortedHistory.at(0)!.start < selector.since) {
    sortedHistory.at(0)!.start = selector.since;
  }

  return sortedHistory;
}