import { BooleanEvent, NumericEvent, StringEvent } from '../../models';
import { TimeRangeSelector, HistorySelector } from '../../models/capabilities/helpers';
import {
  BooleanEventApiResponse,
  EnumEventApiResponse,
  HistoryDetailsApiResponse,
  NumericEventApiResponse
} from '../../api/types';

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
