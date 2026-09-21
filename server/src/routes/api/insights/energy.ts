import { Device } from '../../../models';
import { TimeRangeSelector } from '../../../models/capabilities/helpers';
import { EnergyMonitorCapability } from '../../../models/capabilities';
import { Request, Response } from 'express';
import {
  EnergyDeviceDailyBreakdownApiResponse,
  EnergyDeviceUnitRateDailyApiResponse,
  EnergyPowerInsightsApiResponse,
  EnergyPriceScheduleApiResponse,
  HistoryDetailsApiResponse,
  HistoryLineApiResponse,
  HistoryModesApiResponse,
  BooleanEventApiResponse,
  NumericEventApiResponse,
} from '../../../api/types';
import { PriceSlot } from '../../../helpers/prices';
import {
  mapNumericHistoryToResponse,
  mapBooleanHistoryToResponse,
  mapStringHistoryToResponse,
  bucketByDay,
  daysInRange,
  daysToLineData,
  dailyUnitRate,
} from '../history-helpers';
import { asyncMap } from '../../../helpers/array';
import dayjs from '../../../dayjs';

// One device can meter several loads independently (e.g. an energy meter with a CT clamp
// per appliance), so each instance of its ENERGY_MONITOR capability is its own entity here.
type MonitoredLoad = {
  device: Device;
  label: string;
  energyMonitor: EnergyMonitorCapability;
};

function monitoredLoadsFor(device: Device): MonitoredLoad[] {
  return device.getCapabilityInstances('ENERGY_MONITOR').map((instance) => ({
    device,
    label: instance.name ?? device.name,
    energyMonitor: device.getEnergyMonitorCapability(instance.id)
  }));
}

// The one ENERGY_MONITOR device that also reports ENERGY_COST is the whole-house
// smart meter; every other is an individually-metered load beneath it.
async function splitMeterFromMonitored() {
  const devices = await Device.findByCapability('ENERGY_MONITOR');
  const meter = devices.find((device) => device.getCapabilities().includes('ENERGY_COST')) ?? null;

  return { meter, monitored: devices.filter((device) => device !== meter).flatMap(monitoredLoadsFor) };
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

const FORECAST_HORIZON_DAYS = 7;

function slotToEvent(slot: PriceSlot): NumericEventApiResponse {
  return {
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    lastReported: slot.start.toISOString(),
    value: slot.pence,
  };
}

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

export async function priceScheduleHandler(req: Request, res: Response) {
  const now = new Date();
  const since = new Date(req.query.since as string);

  const [costDevice] = await Device.findByCapability('ENERGY_COST');
  const [evDevice] = await Device.findByCapability('ELECTRIC_VEHICLE');
  const [heatPumpDevice] = await Device.findByCapability('HEAT_PUMP');

  const energyCost = costDevice.getEnergyCostCapability();

  const latestRate = await energyCost.getUnitRateEvent();
  const publishedUntil = latestRate
    ? new Date(Math.max(now.getTime(), latestRate.start.getTime() + 30 * 60 * 1000))
    : now;

  // Published prices run out ~31h ahead on Agile; past that the line continues
  // as forecast. The view honours the range asked for, but never ends before
  // the published prices do, nor past where the forecast reaches.
  const requestedUntil = new Date(req.query.until as string);
  const until = new Date(Math.min(
    Math.max(requestedUntil.getTime() || 0, publishedUntil.getTime()),
    dayjs(now).add(FORECAST_HORIZON_DAYS, 'day').valueOf()
  ));

  const forecastSlots = until > publishedUntil
    ? (await energyCost.getForwardUnitRates(until)).filter((slot) => slot.isEstimated)
    : [];

  const rateSelector = { since, until: publishedUntil };
  // Actual (what ran) is history up to now; planned bands cover now onwards.
  const actualSelector = { since, until: now };

  const rateData = await mapNumericHistoryToResponse((hs) => energyCost.getUnitRateHistory(hs), rateSelector);

  rateData.history = [...rateData.history, ...forecastSlots.map(slotToEvent)];
  rateData.until = until.toISOString();

  const lines: HistoryLineApiResponse[] = [{
    data: rateData,
    label: 'Unit rate (p/kWh)',
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

  res.json({
    lines,
    modes,
    forecastFrom: forecastSlots.length > 0 ? publishedUntil.toISOString() : null,
  } satisfies EnergyPriceScheduleApiResponse);
}

function selectorFromQuery(req: Request): TimeRangeSelector {
  return {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };
}

export async function powerHandler(req: Request, res: Response) {
  const selector = selectorFromQuery(req);

  const devices = await Device.findByCapability('ENERGY_MONITOR');

  const series = await asyncMap(devices.flatMap(monitoredLoadsFor), async ({ label, energyMonitor }) => ({
    data: await mapNumericHistoryToResponse((hs) => energyMonitor.getCurrentPowerHistory(hs), selector),
    label
  }));

  res.json({ series } satisfies EnergyPowerInsightsApiResponse);
}

type Bucketed = { label: string; byDay: Map<string, number> };
type MonitoredLoadGroup = { label: string; loads: MonitoredLoad[] };

// Every LIGHT-capable device collapses into a single "Lights" group, listed
// first; every other load keeps its own group under its existing label.
function groupMonitoredLoads(monitored: MonitoredLoad[]): MonitoredLoadGroup[] {
  const lights = monitored.filter(({ device }) => device.getCapabilities().includes('LIGHT'));
  const rest = monitored.filter(({ device }) => !device.getCapabilities().includes('LIGHT'));
  const groups: MonitoredLoadGroup[] = [];

  if (lights.length > 0) {
    groups.push({ label: 'Lights', loads: lights });
  }

  groups.push(...rest.map((load) => ({ label: load.label, loads: [load] })));

  return groups;
}

async function bucketByEntity(
  bucketFor: (energyMonitor: EnergyMonitorCapability) => Promise<Map<string, number>>,
  monitored: MonitoredLoad[]
): Promise<Bucketed[]> {
  return asyncMap(groupMonitoredLoads(monitored), async ({ label, loads }) => ({
    label,
    byDay: mergeSum(await asyncMap(loads, ({ energyMonitor }) => bucketFor(energyMonitor)))
  }));
}

// Shared by device-cost-daily and device-energy-daily: a stacked per-day
// breakdown of one numeric quantity across every sub-metered entity, topped
// by a hatched "Other" residual (role: 'residual') = the whole-house meter's
// daily total minus everything individually metered, so the stack sums to
// the true house total. Not clamped at 0: a sub-meter reading slightly above
// the whole-house meter should show as a small negative bar, not silently
// vanish.
async function dailyBreakdownSeries(
  selector: TimeRangeSelector,
  meter: Device | null,
  monitored: MonitoredLoad[],
  valueFor: (energyMonitor: EnergyMonitorCapability) => Promise<Map<string, number>>
): Promise<HistoryLineApiResponse[]> {
  const days = daysInRange(selector.since, selector.until);
  const since = selector.since.toISOString();
  const until = selector.until.toISOString();

  const toSeries = (label: string, byDay: Map<string, number>): HistoryLineApiResponse => ({
    label,
    data: daysToLineData(days, since, until, (day) => byDay.get(day) ?? 0)
  });

  const byEntity = await bucketByEntity(valueFor, monitored);
  const series = byEntity.map(({ label, byDay }) => toSeries(label, byDay));

  if (meter) {
    const meterByDay = await valueFor(meter.getEnergyMonitorCapability());
    const monitoredByDay = mergeSum(byEntity.map((entity) => entity.byDay));

    series.push({
      label: 'Other',
      role: 'residual',
      data: daysToLineData(days, since, until, (day) => (meterByDay.get(day) ?? 0) - (monitoredByDay.get(day) ?? 0))
    });
  }

  return series;
}

export async function deviceCostDailyHandler(req: Request, res: Response) {
  const selector = selectorFromQuery(req);
  const { meter, monitored } = await splitMeterFromMonitored();

  const costFor = (energyMonitor: EnergyMonitorCapability) =>
    mapNumericHistoryToResponse((hs) => energyMonitor.getDayCostHistory(hs), selector, (v) => v / 100)
      .then(bucketByDay);

  const series = await dailyBreakdownSeries(selector, meter, monitored, costFor);

  res.json({ series } satisfies EnergyDeviceDailyBreakdownApiResponse);
}

export async function deviceEnergyDailyHandler(req: Request, res: Response) {
  const selector = selectorFromQuery(req);
  const { meter, monitored } = await splitMeterFromMonitored();

  const energyFor = (energyMonitor: EnergyMonitorCapability) =>
    mapNumericHistoryToResponse((hs) => energyMonitor.getDayEnergyHistory(hs), selector).then(bucketByDay);

  const series = await dailyBreakdownSeries(selector, meter, monitored, energyFor);

  res.json({ series } satisfies EnergyDeviceDailyBreakdownApiResponse);
}

export async function deviceUnitRateDailyHandler(req: Request, res: Response) {
  const selector = selectorFromQuery(req);

  const { meter, monitored } = await splitMeterFromMonitored();
  const days = daysInRange(selector.since, selector.until);
  const since = selector.since.toISOString();
  const until = selector.until.toISOString();

  const costFor = (energyMonitor: EnergyMonitorCapability) =>
    mapNumericHistoryToResponse((hs) => energyMonitor.getDayCostHistory(hs), selector).then(bucketByDay);
  const energyFor = (energyMonitor: EnergyMonitorCapability) =>
    mapNumericHistoryToResponse((hs) => energyMonitor.getDayEnergyHistory(hs), selector).then(bucketByDay);

  const [costByEntity, energyByEntity] = await Promise.all([
    bucketByEntity(costFor, monitored),
    bucketByEntity(energyFor, monitored)
  ]);

  const energyByLabel = new Map(energyByEntity.map((entity) => [entity.label, entity.byDay]));

  const rateFor = (cost: Map<string, number>, energy: Map<string, number> | undefined) =>
    dailyUnitRate(cost, energy ?? new Map(), days, since, until);

  const lines: HistoryLineApiResponse[] = costByEntity.map(({ label, byDay }) => ({
    label,
    period: 'day' as const,
    data: rateFor(byDay, energyByLabel.get(label))
  }));

  if (meter) {
    const [meterCost, meterEnergy] = await Promise.all([
      costFor(meter.getEnergyMonitorCapability()),
      energyFor(meter.getEnergyMonitorCapability())
    ]);

    lines.push({
      label: 'Total',
      period: 'day' as const,
      borderDash: [6, 4],
      data: rateFor(meterCost, meterEnergy)
    });
  }

  res.json({ lines } satisfies EnergyDeviceUnitRateDailyApiResponse);
}
