interface HistoryEvent<T> {
  start: T,
  end: T | null
}

export function clampAndSortHistory<U, T extends HistoryEvent<U>>(history: T[], start: U, end: U, expectGaps: boolean): T[] {
  if (history.length === 0) {
    return history;
  }

  const sortedHistory = history.toSorted((a, b) => {
    return a.start > b.start ? 1 : -1;
  });

  // Fix data issues where some events never get ended, leaving multiple "open" events.
  // We "patch" these, by forcing the end to be the start of the next event.
  for (let i=0;i<sortedHistory.length - 1;i++) {
    const currentItem = sortedHistory[i];
    const nextItem = sortedHistory[i+1];

    if (currentItem.end === null) {
      currentItem.end = nextItem.start;
    }

    // Can't !== or ===, as date instances for the same date will not be equal.
    if (!expectGaps && currentItem.end > nextItem.start || currentItem.end < nextItem.end!) {
      currentItem.end = nextItem.start;
    } else if (currentItem.end > nextItem.start) {
      currentItem.end = nextItem.start;
    }
  }

  // If the last event is ongoing, set its end to the end of the window requested.
  if (sortedHistory.at(-1)!.end === null) {
    sortedHistory.at(-1)!.end = end;
  }

  // Having fixed the above, we can end up in scenarios where there were multiple open events
  // prior to the time range selected, so we now have a number of events at the start of the
  // array which aren't for the time period requested.
  while (sortedHistory[0].start < start && sortedHistory[0].end! < start) {
    sortedHistory.shift();
  }

  // If the first event starts before the start of the window, clamp it to the start.
  if (sortedHistory.at(0)!.start < start) {
    sortedHistory.at(0)!.start = start;
  }

  return sortedHistory;
}