import { BooleanEvent, NumericEvent, StringEvent } from '../../models';
import { TimeRangeSelector, HistorySelector } from '../../models/capabilities/helpers';
import {
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

// An effective unit rate (day cost / day energy) is only meaningful once a day's
// energy is above the metering floor. Below this, a sub-meter is reporting its
// own standby draw (~0.01 kWh) and both cost and energy are rounding noise, so
// their ratio is garbage (e.g. 0.13p / 0.01kWh = 13 p/kWh out of nowhere).
export const MIN_DAILY_KWH_FOR_RATE = 0.1;
