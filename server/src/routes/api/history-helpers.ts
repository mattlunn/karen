// Type-only: importing the models for real would pull in config/app, which
// isn't present in CI, so the unit tests could not load this module at all.
import type { BooleanEvent, NumericEvent, StringEvent } from '../../models';
import type { TimeRangeSelector, HistorySelector } from '../../models/capabilities/helpers';
import type {
  BooleanEventApiResponse,
  EnumEventApiResponse,
  HistoryDetailsApiResponse,
  NumericEventApiResponse
} from '../../api/types';
import { filterClampAndSortHistory } from '../../helpers/history';
import dayjs from '../../dayjs';

type NumericHistory = HistoryDetailsApiResponse<NumericEventApiResponse>;

export function mapBooleanHistoryToResponse(
  fetchHistory: (hs: HistorySelector) => Promise<BooleanEvent[]>,
  historySelector: TimeRangeSelector
): Promise<HistoryDetailsApiResponse<BooleanEventApiResponse>> {
  return fetchHistory(historySelector).then(events => ({
    history: events.map((event: BooleanEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: true
    })),
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString()
  }));
}

export function mapNumericHistoryToResponse(
  fetchHistory: (hs: HistorySelector) => Promise<NumericEvent[]>,
  historySelector: TimeRangeSelector,
  transform?: (value: number) => number
): Promise<HistoryDetailsApiResponse<NumericEventApiResponse>> {
  return fetchHistory(historySelector).then(events => ({
    history: events.map((event: NumericEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: transform ? transform(event.value) : event.value
    })),
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString()
  }));
}

export function mapStringHistoryToResponse(
  fetchHistory: (hs: HistorySelector) => Promise<StringEvent[]>,
  historySelector: TimeRangeSelector
): Promise<HistoryDetailsApiResponse<EnumEventApiResponse>> {
  return fetchHistory(historySelector).then(events => ({
    history: events.map((event: StringEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: event.value
    })),
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString()
  }));
}

// Daily events are keyed to Europe/London midnight, but setNumericProperty
// collapses a run of equal-value days into a single spanning event. Expand back
// to one { day-start ISO -> value } entry per calendar day the event covers.
export function bucketByDay(history: NumericHistory): Map<string, number> {
  const events = filterClampAndSortHistory(history.history, history.since, history.until, true);
  const byDay = new Map<string, number>();

  for (const event of events) {
    const end = Date.parse(event.end ?? history.until);

    for (let day = dayjs(event.start).startOf('day'); day.valueOf() < end; day = day.add(1, 'day')) {
      byDay.set(day.toISOString(), event.value);
    }
  }

  return byDay;
}

// Every calendar-day start (ISO) in the range.
export function daysInRange(since: Date, until: Date): string[] {
  const days: string[] = [];

  for (let day = dayjs(since).startOf('day'); day.valueOf() < until.getTime(); day = day.add(1, 'day')) {
    days.push(day.toISOString());
  }

  return days;
}

// One per-calendar-day event ({ start, end } spanning that day) carrying the
// value `valueForDay` returns; days for which it returns undefined are omitted,
// so a line reads as a gap there rather than plotting a zero.
export function daysToLineData(
  days: string[],
  since: string,
  until: string,
  valueForDay: (day: string) => number | undefined
): NumericHistory {
  const history = [];

  for (const day of days) {
    const value = valueForDay(day);

    if (value === undefined) {
      continue;
    }

    const end = dayjs(day).add(1, 'day').toISOString();

    history.push({ start: day, end, lastReported: end, value });
  }

  return { since, until, history };
}

const MIN_INSTANT_STEP_MS = 5 * 60_000;

// A uniform grid of ISO instants across [since, until), spaced range / targetPoints
// apart but never finer than 5 minutes. The whole-house meter only reports once a
// minute, and plotting near that resolution buries the shape of the day in noise.
export function instantsInRange(since: Date, until: Date, targetPoints: number): string[] {
  const step = Math.max(MIN_INSTANT_STEP_MS, (until.getTime() - since.getTime()) / targetPoints);
  const instants: string[] = [];

  for (let t = since.getTime(); t < until.getTime(); t += step) {
    instants.push(new Date(t).toISOString());
  }

  return instants;
}

// The time-weighted mean of the step function over each grid bucket, or null for
// a bucket no event covers.
//
// Averaging rather than reading the value at each instant: a load that cycles
// faster than the grid (an oven element switches every ~15s) would otherwise be
// sampled at whichever point in its duty cycle the instant happened to land on,
// reporting either its full draw or nearly nothing. It also puts every series in
// the same units as the whole-house meter, which reports mean demand per minute -
// so subtracting one from the other is meaningful.
export function averageHistory(history: NumericHistory, instants: string[]): (number | null)[] {
  const events = filterClampAndSortHistory(history.history, history.since, history.until, true);
  const bounds = [...instants, history.until].map((instant) => Date.parse(instant));
  const weighted = new Array(instants.length).fill(0);
  const covered = new Array(instants.length).fill(0);

  let firstBucket = 0;

  for (const event of events) {
    const start = Date.parse(event.start);
    const end = Date.parse(event.end ?? history.until);

    while (firstBucket < instants.length && bounds[firstBucket + 1] <= start) {
      firstBucket++;
    }

    for (let bucket = firstBucket; bucket < instants.length && bounds[bucket] < end; bucket++) {
      const overlap = Math.min(bounds[bucket + 1], end) - Math.max(bounds[bucket], start);

      if (overlap > 0) {
        weighted[bucket] += event.value * overlap;
        covered[bucket] += overlap;
      }
    }
  }

  return weighted.map((total, bucket) => covered[bucket] > 0 ? total / covered[bucket] : null);
}

// One event per instant, spanning through to the next instant (or `until` for
// the last), with no gaps - unlike daysToLineData, valueForInstant cannot
// return undefined, since every series must share the same x-sequence for
// index-based chart stacking to line up.
export function instantsToLineData(
  instants: string[],
  since: string,
  until: string,
  valueForInstant: (instant: string, index: number) => number
): NumericHistory {
  const history = instants.map((instant, index) => {
    const end = instants[index + 1] ?? until;

    return { start: instant, end, lastReported: end, value: valueForInstant(instant, index) };
  });

  return { since, until, history };
}

// Effective p/kWh for each day: that day's cost (pence) over its energy (kWh).
// A day missing either side yields no point rather than a zero, since neither a
// day with no energy nor a day with no cost reading has a meaningful rate.
export function dailyUnitRate(
  costPenceByDay: Map<string, number>,
  energyByDay: Map<string, number>,
  days: string[],
  since: string,
  until: string
): NumericHistory {
  return daysToLineData(days, since, until, (day) => {
    const kwh = energyByDay.get(day);
    const pence = costPenceByDay.get(day);

    return kwh && pence !== undefined ? pence / kwh : undefined;
  });
}
