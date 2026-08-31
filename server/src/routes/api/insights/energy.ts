import { Device } from '../../../models';
import { Request, Response } from 'express';
import {
  EnergyCostInsightsApiResponse,
  EnergyUsageInsightsApiResponse,
  EnergyScheduleApiResponse,
  HistoryDetailsApiResponse,
  HistoryLineApiResponse,
  HistoryModesApiResponse,
  BooleanEventApiResponse,
  NumericEventApiResponse,
} from '../../../api/types';
import { mapNumericHistoryToResponse, mapBooleanHistoryToResponse } from '../history-helpers';
import { asyncMap } from '../../../helpers/array';
import { filterClampAndSortHistory } from '../../../helpers/history';
import dayjs from '../../../dayjs';

type NumericHistory = HistoryDetailsApiResponse<NumericEventApiResponse>;

// The one ENERGY_MONITOR device that also reports ENERGY_COST is the whole-house
// smart meter; every other is an individually-metered load beneath it.
async function splitMeterFromMonitored() {
  const devices = await Device.findByCapability('ENERGY_MONITOR');
  const meter = devices.find((device) => device.getCapabilities().includes('ENERGY_COST')) ?? null;

  return { meter, monitored: devices.filter((device) => device !== meter) };
}

// DayCost events are keyed to Europe/London midnight, but setNumericProperty
// collapses a run of equal-cost days into a single spanning event. Expand back
// to one { day-start ISO -> cost } entry per calendar day the event covers.
function bucketCostByDay(history: NumericHistory): Map<string, number> {
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

// Every calendar-day start (ISO) in the range. Each series carries a value for
// every one of these - 0 where a device had no reading - so the stacked bars
// line up on x and share a uniform width.
function daysInRange(since: Date, until: Date): string[] {
  const days: string[] = [];

  for (let day = dayjs(since).startOf('day'); day.valueOf() < until.getTime(); day = day.add(1, 'day')) {
    days.push(day.toISOString());
  }

  return days;
}

// Adds several { day -> value } maps together, day by day.
function mergeSum(maps: Map<string, number>[]): Map<string, number> {
  const merged = new Map<string, number>();

  for (const map of maps) {
    for (const [day, value] of map) {
      merged.set(day, (merged.get(day) ?? 0) + value);
    }
  }

  return merged;
}

const EV_ACTUAL_COLOR = 'rgba(46, 204, 113, 0.35)';
const EV_PLANNED_COLOR = 'rgba(46, 204, 113, 0.15)';
const DHW_ACTUAL_COLOR = 'rgba(52, 152, 219, 0.35)';
const DHW_PLANNED_COLOR = 'rgba(52, 152, 219, 0.15)';

function blocksToModeData(
  blocks: { start: string; end: string }[],
  since: Date,
  until: Date
): HistoryDetailsApiResponse<BooleanEventApiResponse> {
  return {
    since: since.toISOString(),
    until: until.toISOString(),
    history: blocks.map(b => ({ start: b.start, end: b.end, lastReported: b.end, value: true })),
  };
}

export async function scheduleHandler(req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string),
  };

  const [costDevice] = await Device.findByCapability('ENERGY_COST');
  const [evDevice] = await Device.findByCapability('ELECTRIC_VEHICLE');
  const [heatPumpDevice] = await Device.findByCapability('HEAT_PUMP');

  const lines: HistoryLineApiResponse[] = [{
    data: await mapNumericHistoryToResponse(
      (hs) => costDevice.getEnergyCostCapability().getUnitRateHistory(hs),
      selector
    ),
    label: 'Unit rate (p/kWh)',
    yAxisID: 'yRate',
  }];

  const modes: HistoryModesApiResponse[] = [];

  if (evDevice) {
    const ev = evDevice.getElectricVehicleCapability();

    modes.push({
      data: await mapBooleanHistoryToResponse((hs) => ev.getIsChargingHistory(hs), selector),
      details: [{ value: true, label: 'EV charging', fillColor: EV_ACTUAL_COLOR }],
    });

    modes.push({
      data: blocksToModeData(ev.getPlannedChargeBlocks(), selector.since, selector.until),
      details: [{ value: true, label: 'EV charging (planned)', fillColor: EV_PLANNED_COLOR }],
    });
  }

  if (heatPumpDevice) {
    const heatPump = heatPumpDevice.getHeatPumpCapability();
    const dhwWindow = heatPump.getPlannedDHWWindow();

    modes.push({
      data: await mapBooleanHistoryToResponse((hs) => heatPump.getDHWIsOnHistory(hs), selector),
      details: [{ value: true, label: 'Hot water', fillColor: DHW_ACTUAL_COLOR }],
    });

    modes.push({
      data: blocksToModeData(dhwWindow ? [dhwWindow] : [], selector.since, selector.until),
      details: [{ value: true, label: 'Hot water (planned)', fillColor: DHW_PLANNED_COLOR }],
    });
  }

  res.json({ lines, modes } satisfies EnergyScheduleApiResponse);
}

export async function usageHandler(req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const devices = await Device.findByCapability('ENERGY_MONITOR');

  const series = await asyncMap(devices, async (device) => ({
    data: await mapNumericHistoryToResponse((hs) => device.getEnergyMonitorCapability().getCurrentPowerHistory(hs), selector),
    label: device.name
  }));

  res.json({ series } satisfies EnergyUsageInsightsApiResponse);
}

export async function costHandler(req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const { meter, monitored } = await splitMeterFromMonitored();
  const days = daysInRange(selector.since, selector.until);
  const since = selector.since.toISOString();
  const until = selector.until.toISOString();

  const toSeries = (label: string, byDay: Map<string, number>): HistoryLineApiResponse => ({
    label,
    data: {
      since,
      until,
      history: days.map((day) => {
        const end = dayjs(day).add(1, 'day').toISOString();
        return { start: day, end, lastReported: end, value: byDay.get(day) ?? 0 };
      })
    }
  });

  const costByDay = (device: Device) =>
    mapNumericHistoryToResponse((hs) => device.getEnergyMonitorCapability().getDayCostHistory(hs), selector, (v) => v / 100)
      .then(bucketCostByDay);

  const buckets = await asyncMap(monitored, costByDay);

  const lights: Map<string, number>[] = [];
  const series: HistoryLineApiResponse[] = [];

  monitored.forEach((device, i) => {
    if (device.getCapabilities().includes('LIGHT')) {
      lights.push(buckets[i]);
    } else {
      series.push(toSeries(device.name, buckets[i]));
    }
  });

  if (lights.length > 0) {
    series.unshift(toSeries('Lights', mergeSum(lights)));
  }

  const total = toSeries('Total', meter ? await costByDay(meter) : new Map());

  res.json({ series, total } satisfies EnergyCostInsightsApiResponse);
}
