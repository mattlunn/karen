import { Device } from '../../../models';
import { Request, Response } from 'express';
import { EnergyCostInsightsApiResponse, EnergyUsageInsightsApiResponse, HistoryDetailsApiResponse, NumericEventApiResponse } from '../../../api/types';
import { mapNumericHistoryToResponse } from '../history-helpers';
import { asyncMap } from '../../../helpers/array';
import { filterClampAndSortHistory } from '../../../helpers/history';
import dayjs from '../../../dayjs';

type NumericHistory = HistoryDetailsApiResponse<NumericEventApiResponse>;

// Chart.js stacks datasets by point index, so stacked series must all be sampled
// at the same x values. Each device reports on its own schedule, so re-slice
// every series onto one shared set of `boundaries`, each slice taking the value
// of whichever event covers it (0 where the device has no reading).
function alignToBuckets(histories: NumericHistory[], boundaries: number[]): NumericHistory[] {
  return histories.map((history) => {
    const events = filterClampAndSortHistory(history.history, history.since, history.until, true);
    const aligned: NumericEventApiResponse[] = [];
    let cursor = 0;

    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];

      while (cursor < events.length && Date.parse(events[cursor].end ?? history.until) <= start) {
        cursor++;
      }

      const covering = events[cursor];

      aligned.push({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        lastReported: new Date(end).toISOString(),
        value: covering !== undefined && Date.parse(covering.start) < end ? covering.value : 0
      });
    }

    return { since: history.since, until: history.until, history: aligned };
  });
}

// ~250 evenly-spaced buckets across the range, rounded to whole minutes.
function fixedBoundaries(since: Date, until: Date): number[] {
  const step = Math.max(60_000, Math.ceil((until.getTime() - since.getTime()) / 250 / 60_000) * 60_000);
  const boundaries: number[] = [];

  for (let t = since.getTime(); t < until.getTime(); t += step) {
    boundaries.push(t);
  }

  boundaries.push(until.getTime());

  return boundaries;
}

// One bucket per calendar day (Europe/London), matching how DayCost events are keyed.
function dailyBoundaries(since: Date, until: Date): number[] {
  const boundaries: number[] = [];

  for (let day = dayjs(since).startOf('day'); day.valueOf() < until.getTime(); day = day.add(1, 'day')) {
    boundaries.push(day.valueOf());
  }

  boundaries.push(dayjs(boundaries[boundaries.length - 1] ?? since).add(1, 'day').valueOf());

  return boundaries;
}

// Sums bucket-aligned histories element-wise into a single series.
function sumAlignedHistories(histories: NumericHistory[]): NumericHistory {
  const [first, ...rest] = histories;

  return {
    since: first.since,
    until: first.until,
    history: first.history.map((event, i) => ({
      ...event,
      value: rest.reduce((sum, other) => sum + other.history[i].value, event.value)
    }))
  };
}

// Splits the monitored devices' aligned histories into a single summed "Lights"
// series (every LIGHT-capable device) plus one series per remaining device.
function groupLights(devices: Device[], aligned: NumericHistory[]): { data: NumericHistory; label: string }[] {
  const lights: NumericHistory[] = [];
  const rest: { data: NumericHistory; label: string }[] = [];

  devices.forEach((device, i) => {
    if (device.getCapabilities().includes('LIGHT')) {
      lights.push(aligned[i]);
    } else {
      rest.push({ data: aligned[i], label: device.name });
    }
  });

  return lights.length > 0 ? [{ data: sumAlignedHistories(lights), label: 'Lights' }, ...rest] : rest;
}

// The one ENERGY_MONITOR device that also reports ENERGY_COST is the whole-house
// smart meter; every other is an individually-metered load beneath it.
async function splitMeterFromMonitored() {
  const devices = await Device.findByCapability('ENERGY_MONITOR');
  const meter = devices.find((device) => device.getCapabilities().includes('ENERGY_COST')) ?? null;

  return { meter, monitored: devices.filter((device) => device !== meter) };
}

export async function usageHandler(req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const { meter, monitored } = await splitMeterFromMonitored();
  const histories = await asyncMap(monitored, (device) =>
    mapNumericHistoryToResponse((hs) => device.getEnergyMonitorCapability().getCurrentPowerHistory(hs), selector)
  );

  const aligned = alignToBuckets(histories, fixedBoundaries(selector.since, selector.until));

  res.json({
    series: groupLights(monitored, aligned),
    demand: meter === null ? null : {
      data: await mapNumericHistoryToResponse((hs) => meter.getEnergyMonitorCapability().getCurrentPowerHistory(hs), selector),
      label: 'Demand'
    }
  } satisfies EnergyUsageInsightsApiResponse);
}

export async function costHandler(req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const { meter, monitored } = await splitMeterFromMonitored();
  const boundaries = dailyBoundaries(selector.since, selector.until);
  const histories = await asyncMap(monitored, (device) =>
    mapNumericHistoryToResponse((hs) => device.getEnergyMonitorCapability().getDayCostHistory(hs), selector, (v) => v / 100)
  );

  const aligned = alignToBuckets(histories, boundaries);

  res.json({
    series: groupLights(monitored, aligned),
    total: meter === null ? null : {
      data: await mapNumericHistoryToResponse((hs) => meter.getEnergyMonitorCapability().getDayCostHistory(hs), selector, (v) => v / 100),
      label: 'Total'
    }
  } satisfies EnergyCostInsightsApiResponse);
}
