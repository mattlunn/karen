import dayjs from '../../dayjs';
import { NumericEvent } from '../../models/event';
import { HeatPumpMode, HeatPumpCapability } from '../../models/capabilities';
import { clampAndSortHistory } from '../../helpers/history';
import config from '../../config';
import { Device } from '../../models';
import logger from '../../logger';

interface TimeWindow {
  start: Date;
  end: Date;
}

export interface DailyHeatPumpMetrics {
  dayPower: number;
  dayYield: number;
  dayCoP: number;
  heatingPower: number;
  heatingYield: number;
  heatingCoP: number;
  dhwPower: number;
  dhwYield: number;
  dhwCoP: number;
}

/**
 * Extracts time windows where mode matches any of the specified values.
 * Filters out periods shorter than min_mode_duration_minutes (default 10).
 */
export function getModeWindows(
  modeHistory: NumericEvent[],
  modes: HeatPumpMode[]
): TimeWindow[] {
  const minDurationMinutes = config.ebusd.min_mode_duration_minutes ?? 10;

  return modeHistory
    .filter(event => modes.includes(event.value as HeatPumpMode))
    .filter(event => {
      const durationMinutes = dayjs(event.end).diff(event.start, 'minute');
      return durationMinutes >= minDurationMinutes;
    })
    .map(event => ({
      start: event.start,
      end: event.end!
    }));
}

/**
 * Filters events to only include portions that overlap with the given time windows.
 * Events are split at window boundaries if they partially overlap.
 */
export function filterEventsToModeWindows(
  events: NumericEvent[],
  modeWindows: TimeWindow[]
): NumericEvent[] {
  const result: NumericEvent[] = [];

  for (const event of events) {
    const eventStart = event.start;
    const eventEnd = event.end!;

    for (const window of modeWindows) {
      // Check if event overlaps with this window
      if (eventEnd <= window.start || eventStart >= window.end) {
        continue; // No overlap
      }

      // Calculate the overlapping portion
      const overlapStart = eventStart > window.start ? eventStart : window.start;
      const overlapEnd = eventEnd < window.end ? eventEnd : window.end;

      // Create a new event for just the overlapping portion
      result.push({
        value: event.value,
        start: overlapStart,
        end: overlapEnd,
        lastReported: event.lastReported,
        getDevice: () => event.getDevice()
      } as NumericEvent);
    }
  }

  return result;
}

/**
 * Calculates watt-hours from a series of events by integrating power over time
 */
export function calculateWattHours(events: NumericEvent[]): number {
  return Math.round(100 * events.reduce((acc, curr) => {
    const minutes = dayjs(curr.end).diff(curr.start, 'minute');
    return acc + (curr.value * minutes);
  }, 0) / 60) / 100;
}

/**
 * Calculates COP from power and yield values
 */
export function calculateCoP(powerValue: number, yieldValue: number): number {
  return Math.round(powerValue > 0 ? (powerValue + yieldValue) / powerValue : 0) / 100;
}

/**
 * Main aggregation function - calculates all daily metrics for the heat pump.
 * Filters data by mode to calculate separate metrics for heating and DHW.
 */
export async function calculateDailyHeatPumpMetrics(
  capability: HeatPumpCapability,
  startOfDay: Date,
  endOfDay: Date
): Promise<DailyHeatPumpMetrics> {
  // Fetch all required history data
  const [powerHistory, yieldHistory, modeHistory] = await Promise.all([
    capability.getCurrentPowerHistory({ since: startOfDay, until: endOfDay }),
    capability.getCurrentYieldHistory({ since: startOfDay, until: endOfDay }),
    capability.getModeHistory({ since: startOfDay, until: endOfDay })
  ]);

  // Clamp and sort all histories
  const clampedPower = clampAndSortHistory(powerHistory, startOfDay, endOfDay, false);
  const clampedYield = clampAndSortHistory(yieldHistory, startOfDay, endOfDay, false);
  const clampedMode = clampAndSortHistory(modeHistory, startOfDay, endOfDay, false);

  // Extract time windows for each mode type
  const heatingWindows = getModeWindows(clampedMode, [HeatPumpMode.HEATING]);
  const dhwWindows = getModeWindows(clampedMode, [HeatPumpMode.DHW]);
  const activeWindows = getModeWindows(clampedMode, [HeatPumpMode.HEATING, HeatPumpMode.DHW]);

  // Calculate overall metrics (only when in HEATING or DHW mode)
  const activePower = filterEventsToModeWindows(clampedPower, activeWindows);
  const activeYield = filterEventsToModeWindows(clampedYield, activeWindows);
  const dayPower = calculateWattHours(activePower);
  const dayYield = calculateWattHours(activeYield);
  const dayCoP = calculateCoP(dayPower, dayYield);

  // Calculate heating-specific metrics
  const heatingPowerEvents = filterEventsToModeWindows(clampedPower, heatingWindows);
  const heatingYieldEvents = filterEventsToModeWindows(clampedYield, heatingWindows);
  const heatingPower = calculateWattHours(heatingPowerEvents);
  const heatingYield = calculateWattHours(heatingYieldEvents);
  const heatingCoP = calculateCoP(heatingPower, heatingYield);

  // Calculate DHW-specific metrics
  const dhwPowerEvents = filterEventsToModeWindows(clampedPower, dhwWindows);
  const dhwYieldEvents = filterEventsToModeWindows(clampedYield, dhwWindows);
  const dhwPower = calculateWattHours(dhwPowerEvents);
  const dhwYield = calculateWattHours(dhwYieldEvents);
  const dhwCoP = calculateCoP(dhwPower, dhwYield);

  return {
    dayPower,
    dayYield,
    dayCoP,
    heatingPower,
    heatingYield,
    heatingCoP,
    dhwPower,
    dhwYield,
    dhwCoP
  };
}

const DAILY_METRIC_COUNT = 9; // Number of daily metrics we track

/**
 * Store daily metrics for a given day.
 * For completed days, timestamp is end of day.
 * For today's running metrics, timestamp is start of day (to enable updates).
 */
export async function storeDailyMetrics(
  capability: HeatPumpCapability,
  startOfDay: Date,
  endOfDay: Date,
  timestamp?: Date
): Promise<void> {
  const metrics = await calculateDailyHeatPumpMetrics(capability, startOfDay, endOfDay);
  const eventTimestamp = timestamp ?? endOfDay;

  await Promise.all([
    capability.setDayCoPState(metrics.dayCoP, eventTimestamp),
    capability.setDayPowerState(metrics.dayPower, eventTimestamp),
    capability.setDayYieldState(metrics.dayYield, eventTimestamp),
    capability.setDayHeatingCoPState(metrics.heatingCoP, eventTimestamp),
    capability.setDayHeatingPowerState(metrics.heatingPower, eventTimestamp),
    capability.setDayHeatingYieldState(metrics.heatingYield, eventTimestamp),
    capability.setDayDHWCoPState(metrics.dhwCoP, eventTimestamp),
    capability.setDayDHWPowerState(metrics.dhwPower, eventTimestamp),
    capability.setDayDHWYieldState(metrics.dhwYield, eventTimestamp),
  ]);

  logger.info(`Daily metrics for ${dayjs(startOfDay).format('DD/MM/YYYY')}: CoP=${metrics.dayCoP.toFixed(1)}, HeatingCoP=${metrics.heatingCoP.toFixed(1)}, DHWCoP=${metrics.dhwCoP.toFixed(1)}`);
}

/**
 * Ensure all historical daily metrics exist and are up-to-date.
 * Called at midnight to backfill missing days and recalculate outdated ones.
 * Also handles yesterday (the most recently completed day).
 */
export async function ensureHistoricalMetrics(device: Device, capability: HeatPumpCapability): Promise<void> {
  const cutoffDate = config.ebusd.recalculate_cutoff
    ? dayjs(config.ebusd.recalculate_cutoff)
    : null;
  const startDate = dayjs(device.createdAt).startOf('day');
  // Include yesterday (today at midnight means yesterday is last complete day)
  const endDate = dayjs().startOf('day');

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

/**
 * Calculate and store today's running metrics.
 * Uses start of day as timestamp so updates modify existing events.
 */
export async function storeTodayRunningMetrics(capability: HeatPumpCapability): Promise<void> {
  const startOfDay = dayjs().startOf('day').toDate();
  const now = new Date();

  // Use startOfDay as timestamp - this ensures we update the same event each time
  await storeDailyMetrics(capability, startOfDay, now, startOfDay);
}
