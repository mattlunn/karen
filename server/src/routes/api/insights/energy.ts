import { Device } from '../../../models';
import { TimeRangeSelector } from '../../../models/capabilities/helpers';
import { EnergyMonitorCapability } from '../../../models/capabilities';
import { Request, Response } from 'express';
import {
  EnergyDeviceDailyBreakdownApiResponse,
  EnergyDeviceSummaryApiResponse,
  EnergyPeriodTotalsApiResponse,
  EnergyDeviceUnitRateDailyApiResponse,
  EnergyPowerInsightsApiResponse,
  HistoryLineApiResponse,
} from '../../../api/types';
import {
  mapNumericHistoryToResponse,
  bucketByDay,
  daysInRange,
  daysToLineData,
  dailyUnitRate,
} from '../history-helpers';
import { CURRENT_TARIFF_START } from '../device-helpers';
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

function selectorFromQuery(req: Request): TimeRangeSelector {
  return {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };
}

export async function powerHandler(req: Request, res: Response) {
  const selector = selectorFromQuery(req);

  const [devices, [costDevice]] = await Promise.all([
    Device.findByCapability('ENERGY_MONITOR'),
    Device.findByCapability('ENERGY_COST')
  ]);

  const energyCost = costDevice.getEnergyCostCapability();
  const [powerSeries, unitRate, wholeDaysUnitRates] = await Promise.all([
    asyncMap(devices.flatMap(monitoredLoadsFor), async ({ label, energyMonitor }) => ({
      data: await mapNumericHistoryToResponse((hs) => energyMonitor.getCurrentPowerHistory(hs), selector),
      label
    })),
    mapNumericHistoryToResponse((hs) => energyCost.getUnitRateHistory(hs), selector),
    energyCost.getUnitRateHistory({
      since: dayjs(selector.since).startOf('day').toDate(),
      until: dayjs(selector.until).endOf('day').toDate()
    })
  ]);

  res.json({
    series: [...powerSeries, { data: unitRate, label: 'Unit rate (p/kWh)', yAxisID: 'yRate', filled: true }],
    wholeDaysMaxUnitRate: wholeDaysUnitRates.length > 0 ? Math.max(...wholeDaysUnitRates.map((event) => event.value)) : null
  } satisfies EnergyPowerInsightsApiResponse);
}

type Bucketed = { label: string; deviceId: number | null; byDay: Map<string, number> };

// Every LIGHT-capable device collapses into a single "Lights" entry, listed first.
async function bucketByEntity(
  bucketFor: (energyMonitor: EnergyMonitorCapability) => Promise<Map<string, number>>,
  monitored: MonitoredLoad[]
): Promise<Bucketed[]> {
  const buckets = await asyncMap(monitored, ({ energyMonitor }) => bucketFor(energyMonitor));

  const lights: Map<string, number>[] = [];
  const named: Bucketed[] = [];

  monitored.forEach(({ device, label }, i) => {
    if (device.getCapabilities().includes('LIGHT')) {
      lights.push(buckets[i]);
    } else {
      named.push({ label, deviceId: device.id, byDay: buckets[i] });
    }
  });

  if (lights.length > 0) {
    named.unshift({ label: 'Lights', deviceId: null, byDay: mergeSum(lights) });
  }

  return named;
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

function periodTotals(
  since: Date,
  costPenceByDay: Map<string, number>,
  energyByDay: Map<string, number>
): EnergyPeriodTotalsApiResponse {
  const sumSince = (byDay: Map<string, number>) => [...byDay]
    .filter(([day]) => Date.parse(day) >= since.getTime())
    .reduce((sum, [, value]) => sum + value, 0);

  const costPence = sumSince(costPenceByDay);
  const energyKwh = sumSince(energyByDay);

  return { energyKwh, costPence, unitRate: energyKwh > 0 ? costPence / energyKwh : null };
}

export async function deviceSummaryHandler(req: Request, res: Response) {
  const now = new Date();
  const lastMonthSince = dayjs(now).subtract(1, 'month').startOf('day').toDate();
  const selector = { since: CURRENT_TARIFF_START, until: now };
  const { meter, monitored } = await splitMeterFromMonitored();

  const costFor = (energyMonitor: EnergyMonitorCapability) =>
    mapNumericHistoryToResponse((hs) => energyMonitor.getDayCostHistory(hs), selector).then(bucketByDay);
  const energyFor = (energyMonitor: EnergyMonitorCapability) =>
    mapNumericHistoryToResponse((hs) => energyMonitor.getDayEnergyHistory(hs), selector).then(bucketByDay);

  const [costByEntity, energyByEntity] = await Promise.all([
    bucketByEntity(costFor, monitored),
    bucketByEntity(energyFor, monitored)
  ]);

  const toRow = (
    label: string,
    deviceId: number | null,
    costPence: Map<string, number>,
    energy: Map<string, number>
  ) => ({
    label,
    deviceId,
    thisTariff: periodTotals(CURRENT_TARIFF_START, costPence, energy),
    lastMonth: periodTotals(lastMonthSince, costPence, energy)
  });

  const rows: EnergyDeviceSummaryApiResponse['rows'] = costByEntity
    .map(({ label, deviceId, byDay }, i) => toRow(label, deviceId, byDay, energyByEntity[i].byDay))
    .sort((a, b) => b.thisTariff.costPence - a.thisTariff.costPence);

  if (meter) {
    const [meterCost, meterEnergy] = await Promise.all([
      costFor(meter.getEnergyMonitorCapability()),
      energyFor(meter.getEnergyMonitorCapability())
    ]);

    const monitoredCost = mergeSum(costByEntity.map((entity) => entity.byDay));
    const monitoredEnergy = mergeSum(energyByEntity.map((entity) => entity.byDay));
    const residual = (total: Map<string, number>, monitoredByDay: Map<string, number>) =>
      new Map([...total].map(([day, value]) => [day, value - (monitoredByDay.get(day) ?? 0)]));

    rows.push(
      { ...toRow('Other', null, residual(meterCost, monitoredCost), residual(meterEnergy, monitoredEnergy)), role: 'residual' },
      { ...toRow('Total', meter.id, meterCost, meterEnergy), role: 'total' }
    );
  }

  res.json({
    thisTariffSince: CURRENT_TARIFF_START.toISOString(),
    rows
  } satisfies EnergyDeviceSummaryApiResponse);
}
