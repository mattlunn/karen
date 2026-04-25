import { BooleanEvent, NumericEvent } from '../../models';
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
  historySelector: TimeRangeSelector
): Promise<HistoryDetailsApiResponse<NumericEventApiResponse>> {
  return fetchHistory(historySelector).then(events => ({
    history: events.map((event: NumericEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: event.value
    })),
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString()
  }));
}

export function computeCumulativeNumericResponse(
  events: NumericEvent[],
  selector: TimeRangeSelector
): HistoryDetailsApiResponse<NumericEventApiResponse> {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const history: NumericEventApiResponse[] = [];
  let cumulativeKWh = 0;

  for (const event of sorted) {
    const endTime = event.end ?? event.lastReported;
    const durationHours = (endTime.getTime() - event.start.getTime()) / 3600000;
    cumulativeKWh += event.value * durationHours / 1000;

    history.push({
      start: event.start.toISOString(),
      end: endTime.toISOString(),
      lastReported: event.lastReported.toISOString(),
      value: Math.round(cumulativeKWh * 100) / 100
    });
  }

  return {
    history,
    since: selector.since.toISOString(),
    until: selector.until.toISOString()
  };
}

export function mapEnumHistoryToResponse(
  fetchHistory: (hs: HistorySelector) => Promise<NumericEvent[]>,
  historySelector: TimeRangeSelector,
  map: Record<number, string>
): Promise<HistoryDetailsApiResponse<EnumEventApiResponse>> {
  return fetchHistory(historySelector).then(events => ({
    history: events.map((event: NumericEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: map[event.value]
    })),
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString()
  }));
}
