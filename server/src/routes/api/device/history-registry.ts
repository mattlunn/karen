import { Device, BooleanEvent, NumericEvent } from '../../../models';
import { TimeRangeSelector, HistorySelector } from '../../../models/capabilities/helpers';
import {
  BooleanEventApiResponse,
  EnumEventApiResponse,
  HistoryDetailsApiResponse,
  NumericEventApiResponse
} from '../../../api/types';

export type HistoryLineResponse = {
  data: HistoryDetailsApiResponse<NumericEventApiResponse>;
  label: string;
  yAxisID?: string;
};

export type HistoryModeDetail = {
  value: string | true;
  label: string;
  fillColor?: string;
};

export type HistoryModesResponse = {
  data: HistoryDetailsApiResponse<EnumEventApiResponse | BooleanEventApiResponse>;
  details: HistoryModeDetail[];
};

export type HistoryBarResponse = {
  data: HistoryDetailsApiResponse<NumericEventApiResponse>;
  label: string;
  yAxisID?: string;
};

export type HistoryResponse = {
  lines: HistoryLineResponse[];
  modes?: HistoryModesResponse;
  bar?: HistoryBarResponse;
};

export type HistoryFetcher = (device: Device, selector: TimeRangeSelector) => Promise<HistoryResponse>;

const registry = new Map<string, HistoryFetcher>();

export function registerHistory(id: string, fetcher: HistoryFetcher): void {
  if (registry.has(id)) {
    throw new Error(`History fetcher with id "${id}" is already registered`);
  }
  registry.set(id, fetcher);
}

export function getHistoryFetcher(id: string): HistoryFetcher | undefined {
  return registry.get(id);
}

export function hasHistoryFetcher(id: string): boolean {
  return registry.has(id);
}

export async function mapBooleanHistoryToResponse(
  fetchHistory: (hs: HistorySelector) => Promise<BooleanEvent[]>,
  historySelector: TimeRangeSelector
): Promise<HistoryDetailsApiResponse<BooleanEventApiResponse>> {
  return {
    history: (await fetchHistory(historySelector)).map((event: BooleanEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: true
    })),
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString()
  };
}

export async function mapNumericHistoryToResponse(
  fetchHistory: (hs: HistorySelector) => Promise<NumericEvent[]>,
  historySelector: TimeRangeSelector
): Promise<HistoryDetailsApiResponse<NumericEventApiResponse>> {
  return {
    history: (await fetchHistory(historySelector)).map((event: NumericEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: event.value
    })),
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString()
  };
}

export async function mapEnumHistoryToResponse(
  fetchHistory: (hs: HistorySelector) => Promise<NumericEvent[]>,
  historySelector: TimeRangeSelector,
  map: Record<number, string>
): Promise<HistoryDetailsApiResponse<EnumEventApiResponse>> {
  return {
    history: (await fetchHistory(historySelector)).map((event: NumericEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: map[event.value]
    })),
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString()
  };
}
