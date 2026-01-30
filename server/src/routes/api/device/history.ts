import { Device, BooleanEvent, NumericEvent } from '../../../models';
import { TimeRangeSelector, HistorySelector } from '../../../models/capabilities/helpers';
import expressAsyncWrapper from '../../../helpers/express-async-wrapper';
import dayjs from '../../../dayjs';
import {
  BooleanEventApiResponse,
  EnumEventApiResponse,
  HistoryDetailsApiResponse,
  NumericEventApiResponse
} from '../../../api/types';

// Types

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

type HistoryFetcher = (device: Device, selector: TimeRangeSelector) => Promise<HistoryResponse>;

// Helpers

type AwaitedObject<T> = {
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K];
};

async function awaitPromises<T extends Record<string, unknown>>(obj: T): Promise<AwaitedObject<T>> {
  const entries = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );

  return Object.fromEntries(entries) as AwaitedObject<T>;
}

function mapBooleanHistoryToResponse(
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

function mapNumericHistoryToResponse(
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

function mapEnumHistoryToResponse(
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

// Registry

const historyFetchers = new Map<string, HistoryFetcher>([
  // Heat Pump - Power (Yield + Power with modes)
  ['heatpump-power', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return awaitPromises({
      lines: Promise.all([
        mapNumericHistoryToResponse((hs) => heatPump.getCurrentYieldHistory(hs), selector)
          .then(data => ({ data, label: 'Yield' })),
        mapNumericHistoryToResponse((hs) => heatPump.getCurrentPowerHistory(hs), selector)
          .then(data => ({ data, label: 'Power' }))
      ]),
      modes: mapEnumHistoryToResponse((hs) => heatPump.getModeHistory(hs), selector, {
        0: 'UNKNOWN',
        1: 'STANDBY',
        2: 'HEATING',
        3: 'DHW',
        4: 'DEICING',
        5: 'FROST_PROTECTION',
      }).then(data => ({
        data,
        details: [
          { value: 'HEATING', label: 'Heating' },
          { value: 'DEICING', label: 'Deicing' },
          { value: 'FROST_PROTECTION', label: 'Frost Protection' },
          { value: 'DHW', label: 'Hot Water' }
        ]
      }))
    });
  }],

  // Heat Pump - Outside Temperature
  ['heatpump-outside-temp', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return {
      lines: [
        {
          data: await mapNumericHistoryToResponse((hs) => heatPump.getOutsideTemperatureHistory(hs), selector),
          label: 'Outside Temperature'
        }
      ]
    };
  }],

  // Heat Pump - DHW Temperature
  ['heatpump-dhw-temp', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return {
      lines: [
        {
          data: await mapNumericHistoryToResponse((hs) => heatPump.getDHWTemperatureHistory(hs), selector),
          label: 'Hot Water Temperature'
        }
      ]
    };
  }],

  // Heat Pump - Flow Temperature (Flow + Return)
  ['heatpump-flow-temp', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return {
      lines: await Promise.all([
        mapNumericHistoryToResponse((hs) => heatPump.getActualFlowTemperatureHistory(hs), selector)
          .then(data => ({ data, label: 'Actual Flow Temperature' })),
        mapNumericHistoryToResponse((hs) => heatPump.getReturnTemperatureHistory(hs), selector)
          .then(data => ({ data, label: 'Return Temperature' }))
      ])
    };
  }],

  // Heat Pump - System Pressure
  ['heatpump-pressure', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return {
      lines: [
        {
          data: await mapNumericHistoryToResponse((hs) => heatPump.getSystemPressureHistory(hs), selector),
          label: 'System Pressure'
        }
      ]
    };
  }],

  // Thermostat
  ['thermostat', async (device, selector) => {
    const thermostat = device.getThermostatCapability();

    return awaitPromises({
      lines: Promise.all([
        mapNumericHistoryToResponse((hs) => thermostat.getCurrentTemperatureHistory(hs), selector)
          .then(data => ({ data, label: 'Current Temperature', yAxisID: 'yTemperature' })),
        mapNumericHistoryToResponse((hs) => thermostat.getTargetTemperatureHistory(hs), selector)
          .then(data => ({ data, label: 'Target Temperature', yAxisID: 'yTemperature' }))
      ]),
      bar: mapNumericHistoryToResponse((hs) => thermostat.getPowerHistory(hs), selector)
        .then(data => ({ data, label: 'Power', yAxisID: 'yPercentage' }))
    });
  }],

  // Light
  ['light', async (device, selector) => {
    const light = device.getLightCapability();

    return awaitPromises({
      lines: Promise.all([
        mapNumericHistoryToResponse((hs) => light.getBrightnessHistory(hs), selector)
          .then(data => ({ data, label: 'Brightness' }))
      ]),
      modes: mapBooleanHistoryToResponse((hs) => light.getIsOnHistory(hs), selector)
        .then(data => ({
          data,
          details: [
            { value: true as const, label: 'On', fillColor: 'rgba(255, 165, 0, 0.3)' }
          ]
        }))
    });
  }]
]);

// Route handler

export default expressAsyncWrapper(async function (req, res, next) {
  const graphId = req.query.id as string | undefined;

  if (!graphId) {
    return res.status(400).json({ error: 'Missing required query parameter: id' });
  }

  const fetcher = historyFetchers.get(graphId);

  if (!fetcher) {
    return res.status(400).json({ error: `Unknown graph id: ${graphId}` });
  }

  const device = await Device.findById(req.params.id);

  if (!device) {
    return next('route');
  }

  const sinceParam = req.query.since as string | undefined;
  const untilParam = req.query.until as string | undefined;

  const historySelector = {
    since: sinceParam ? new Date(sinceParam) : dayjs().startOf('day').toDate(),
    until: untilParam ? new Date(untilParam) : new Date()
  };

  const response = await fetcher(device, historySelector);
  res.json(response);
});
