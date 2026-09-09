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
} from '../../../api/types';
import {
  mapNumericHistoryToResponse,
  mapBooleanHistoryToResponse,
  mapStringHistoryToResponse,
  bucketByDay,
  daysInRange,
  daysToLineData,
} from '../history-helpers';
import { asyncMap } from '../../../helpers/array';
import dayjs from '../../../dayjs';

// The one ENERGY_MONITOR device that also reports ENERGY_COST is the whole-house
// smart meter; every other is an individually-metered load beneath it.
async function splitMeterFromMonitored() {
  const devices = await Device.findByCapability('ENERGY_MONITOR');
  const meter = devices.find((device) => device.getCapabilities().includes('ENERGY_COST')) ?? null;

  return { meter, monitored: devices.filter((device) => device !== meter) };
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
  const now = new Date();
  const since = new Date(req.query.since as string);

  const [costDevice] = await Device.findByCapability('ENERGY_COST');
  const [evDevice] = await Device.findByCapability('ELECTRIC_VEHICLE');
  const [heatPumpDevice] = await Device.findByCapability('HEAT_PUMP');

  const energyCost = costDevice.getEnergyCostCapability();

  // The view ends where the published prices do (the whole point of the graph)
  // - not at a fixed +24h. Fetch generously (Agile's horizon peaks at ~31h).
  const latestRate = await energyCost.getUnitRateEvent();
  const until = latestRate
    ? new Date(Math.max(now.getTime(), latestRate.start.getTime() + 30 * 60 * 1000))
    : now;
  const rateSelector = { since, until: dayjs(now).add(48, 'hour').toDate() };
  // Actual (what ran) is history up to now; planned bands cover now onwards.
  const actualSelector = { since, until: now };

  const rateData = await mapNumericHistoryToResponse((hs) => energyCost.getUnitRateHistory(hs), rateSelector);
  rateData.until = until.toISOString();

  const lines: HistoryLineApiResponse[] = [{
    data: rateData,
    label: 'Unit rate (p/kWh)',
    yAxisID: 'yRate',
  }];

  const modes: HistoryModesApiResponse[] = [];

  if (evDevice) {
    const ev = evDevice.getElectricVehicleCapability();

    modes.push({
      data: await mapBooleanHistoryToResponse((hs) => ev.getIsChargingHistory(hs), actualSelector),
      details: [{ value: true, label: 'EV charging', fillColor: EV_ACTUAL_COLOR }],
    });

    modes.push({
      data: blocksToModeData(ev.getPlannedChargeBlocks(), since, until),
      details: [{ value: true, label: 'EV charging (planned)', fillColor: EV_PLANNED_COLOR }],
    });
  }

  if (heatPumpDevice) {
    const heatPump = heatPumpDevice.getHeatPumpCapability();
    const dhwWindow = heatPump.getPlannedDHWWindow();

    // "actually heating water", not "circuit permitted" (which can sit on for days).
    modes.push({
      data: await mapStringHistoryToResponse((hs) => heatPump.getModeHistory(hs), actualSelector),
      details: [{ value: 'DHW', label: 'Hot water', fillColor: DHW_ACTUAL_COLOR }],
    });

    modes.push({
      data: blocksToModeData(dhwWindow ? [dhwWindow] : [], since, until),
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
    data: daysToLineData(days, since, until, (day) => byDay.get(day) ?? 0)
  });

  const costByDay = (device: Device) =>
    mapNumericHistoryToResponse((hs) => device.getEnergyMonitorCapability().getDayCostHistory(hs), selector, (v) => v / 100)
      .then(bucketByDay);

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
