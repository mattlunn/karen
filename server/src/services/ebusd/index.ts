import { Device } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import EbusClient from './client';
import setIntervalForTime from '../../helpers/set-interval-for-time';
import dayjs, { Dayjs } from '../../dayjs';
import { calculateDailyHeatPumpMetrics } from './aggregation';
import { HeatPumpCapability } from '../../models/capabilities';
import logger from '../../logger';

Device.registerProvider('ebusd', {
  getCapabilities(device) {
    return ['HEAT_PUMP'];
  },

  async synchronize() {
    let device = await Device.findByProviderId('ebusd', 'heatpump');

    if (device === null) {
      device = Device.build({
        provider: 'ebusd',
        providerId: 'heatpump',
        name: 'Heat Pump',
      });
    }

    device.manufacturer = 'Vaillant';
    device.model = 'aroTHERM Plus';

    await device.save();
  }
});

export async function setDHWMode(isOn: boolean) {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  await client.setIsDHWOn(isOn);
}

export async function getDHWMode(): Promise<boolean> {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  return device.getHeatPumpCapability().getDHWIsOn();
}

nowAndSetInterval(createBackgroundTransaction('ebusd:poll', async () => {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const deviceCapability = device.getHeatPumpCapability();
  
  async function updateState<T>(getter: () => Promise<T>, updater: (value: T) => Promise<unknown>) {
    await updater(await getter());
  }

  function roundTo1DecimalPlace(val: number) {
    return Math.round(val * 10) / 10;
  }

  await Promise.all([
    updateState(() => client.getOutsideTemperature(), (v) => deviceCapability.setOutsideTemperatureState(roundTo1DecimalPlace(v))),

    updateState(() => client.getActualFlowTemperature(), (v) => deviceCapability.setActualFlowTemperatureState(roundTo1DecimalPlace(v))),
    updateState(() => client.getDesiredFlowTemperature(), (v) => deviceCapability.setDesiredFlowTemperatureState(roundTo1DecimalPlace(v))),
    updateState(() => client.getReturnTemperature(), (v) => deviceCapability.setReturnTemperatureState(roundTo1DecimalPlace(v))),

    updateState(() => client.getCompressorPower(), (v) => deviceCapability.setCompressorPowerState(v)),
    updateState(() => client.getCompressorModulation(), (v) => deviceCapability.setCompressorModulationState(v)),

    updateState(() => client.getHotWaterCylinderTemperature(), (v) => deviceCapability.setDHWTemperatureState(v)),
    updateState(() => client.getSystemPressure(), (v) => deviceCapability.setSystemPressureState(v)),

    updateState(() => client.getEnergyDaily(), (v) => deviceCapability.setDailyConsumedEnergyState(v)),
    updateState(() => client.getCurrentPower(), (v) => deviceCapability.setCurrentPowerState(roundTo1DecimalPlace(v))),
    updateState(() => client.getCurrentYield(), (v) => deviceCapability.setCurrentYieldState(roundTo1DecimalPlace(v))),
    updateState(() => client.getMode(), (v) => deviceCapability.setModeState(v)),
    updateState(() => client.getCopHwc(), (v) => deviceCapability.setDHWCoPState(v)),
    updateState(() => client.getCopHc(), (v) => deviceCapability.setHeatingCoPState(v)),
    updateState(() => client.getDHWIsOn(), (v) => deviceCapability.setDHWIsOnState(v))
  ]);
}), Math.max(config.ebusd.poll_interval_minutes, 1) * 60 * 1000);

async function storeDailyMetrics(capability: HeatPumpCapability, startOfDay: Date, endOfDay: Date): Promise<void> {
  const metrics = await calculateDailyHeatPumpMetrics(capability, startOfDay, endOfDay);

  await Promise.all([
    capability.setDayCoPState(metrics.dayCoP, endOfDay),
    capability.setDayPowerState(metrics.dayPower, endOfDay),
    capability.setDayYieldState(metrics.dayYield, endOfDay),
    capability.setDayHeatingCoPState(metrics.heatingCoP, endOfDay),
    capability.setDayHeatingPowerState(metrics.heatingPower, endOfDay),
    capability.setDayHeatingYieldState(metrics.heatingYield, endOfDay),
    capability.setDayDHWCoPState(metrics.dhwCoP, endOfDay),
    capability.setDayDHWPowerState(metrics.dhwPower, endOfDay),
    capability.setDayDHWYieldState(metrics.dhwYield, endOfDay),
  ]);

  logger.info(`Daily metrics for ${dayjs(startOfDay).format('DD/MM/YYYY')}: CoP=${metrics.dayCoP.toFixed(1)}, HeatingCoP=${metrics.heatingCoP.toFixed(1)}, DHWCoP=${metrics.dhwCoP.toFixed(1)}`);
}

const DAILY_METRIC_COUNT = 9; // Number of daily metrics we track

/**
 * Backfill or recalculate historic daily metrics.
 * Called at midnight before calculating the previous day's metrics.
 *
 * Uses capability history methods to fetch all metrics at once, then determines
 * which days need (re)calculation based on missing metrics or outdated updatedAt.
 */
async function recalculateHistoricMetrics(device: Device, capability: HeatPumpCapability): Promise<void> {
  const cutoffDate = config.ebusd.recalculate_cutoff
    ? dayjs(config.ebusd.recalculate_cutoff)
    : null;
  const startDate = dayjs(device.createdAt).startOf('day');
  const endDate = dayjs().startOf('day'); // Today at midnight (yesterday is last complete day)

  // Fetch all daily metric histories for the entire date range
  const historyRange = { since: startDate.toDate(), until: endDate.toDate() };

  const [
    dayCoPHistory,
    dayPowerHistory,
    dayYieldHistory,
    dayHeatingCoPHistory,
    dayHeatingPowerHistory,
    dayHeatingYieldHistory,
    dayDHWCoPHistory,
    dayDHWPowerHistory,
    dayDHWYieldHistory
  ] = await Promise.all([
    capability.getDayCoPHistory(historyRange),
    capability.getDayPowerHistory(historyRange),
    capability.getDayYieldHistory(historyRange),
    capability.getDayHeatingCoPHistory(historyRange),
    capability.getDayHeatingPowerHistory(historyRange),
    capability.getDayHeatingYieldHistory(historyRange),
    capability.getDayDHWCoPHistory(historyRange),
    capability.getDayDHWPowerHistory(historyRange),
    capability.getDayDHWYieldHistory(historyRange)
  ]);

  // Build a map of day -> { count: number, oldestUpdatedAt: Date }
  // Each metric's start date is the end of the day it represents
  const dayMetricsMap = new Map<string, { count: number; oldestUpdatedAt: Date }>();

  const allHistories = [
    dayCoPHistory,
    dayPowerHistory,
    dayYieldHistory,
    dayHeatingCoPHistory,
    dayHeatingPowerHistory,
    dayHeatingYieldHistory,
    dayDHWCoPHistory,
    dayDHWPowerHistory,
    dayDHWYieldHistory
  ];

  for (const history of allHistories) {
    for (const event of history) {
      const dayKey = dayjs(event.start).format('YYYY-MM-DD');
      const existing = dayMetricsMap.get(dayKey);

      if (existing) {
        existing.count++;
        if (event.updatedAt < existing.oldestUpdatedAt) {
          existing.oldestUpdatedAt = event.updatedAt;
        }
      } else {
        dayMetricsMap.set(dayKey, { count: 1, oldestUpdatedAt: event.updatedAt });
      }
    }
  }

  // Iterate through all days and calculate those that need it
  for (let day = startDate; day.isBefore(endDate); day = day.add(1, 'day')) {
    const dayKey = day.add(1, 'day').format('YYYY-MM-DD'); // Metrics are stored at end of day
    const dayStart = day.toDate();
    const dayEnd = day.add(1, 'day').toDate();

    const metrics = dayMetricsMap.get(dayKey);

    // Calculate if: metrics missing, not all metrics present, or outdated
    const shouldCalculate = !metrics
      || metrics.count < DAILY_METRIC_COUNT
      || (cutoffDate && dayjs(metrics.oldestUpdatedAt).isBefore(cutoffDate));

    if (shouldCalculate) {
      logger.info(`Calculating heat pump metrics for ${day.format('YYYY-MM-DD')}`);
      await storeDailyMetrics(capability, dayStart, dayEnd);
    }
  }
}

// Calculate daily metrics at midnight
setIntervalForTime(async () => {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const capability = device.getHeatPumpCapability();

  // First, backfill any missing or outdated historic metrics
  await recalculateHistoricMetrics(device, capability);

  // Then calculate yesterday's metrics (the day that just ended)
  const endOfDay = dayjs().toDate();
  const startOfDay = dayjs(endOfDay).subtract(1, 'd').toDate();
  await storeDailyMetrics(capability, startOfDay, endOfDay);
}, '00:00');