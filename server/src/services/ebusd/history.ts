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

interface PrefetchedEvents {
  powerHistory: NumericEvent[];
  yieldHistory: NumericEvent[];
  modeHistory: NumericEvent[];
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
  return Math.round(powerValue > 0 ? ((powerValue + yieldValue) / powerValue) * 100 : 0) / 100;
}

/**
 * Main aggregation function - calculates all daily metrics for the heat pump.
 * Accepts pre-fetched events to avoid repeated DB queries when called in a loop.
 */
export async function calculateDailyHeatPumpMetrics(
  capability: HeatPumpCapability,
  startOfDay: Date,
  endOfDay: Date,
  prefetched?: PrefetchedEvents
): Promise<DailyHeatPumpMetrics> {
  const [powerHistory, yieldHistory, modeHistory] = prefetched
    ? [prefetched.powerHistory, prefetched.yieldHistory, prefetched.modeHistory]
    : await Promise.all([
        capability.getCurrentPowerHistory({ since: startOfDay, until: endOfDay }),
        capability.getCurrentYieldHistory({ since: startOfDay, until: endOfDay }),
        capability.getModeHistory({ since: startOfDay, until: endOfDay })
      ]);

  // Clamp and sort all histories to the requested window
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

/**
 * Store daily metrics for a given window (startOfDay → endOfDay).
 * Day* properties are stored at startOfDay (updated in-place throughout the day).
 * DayCumulative* properties are stored at cumulativeAt (defaults to endOfDay),
 * creating a new event each time for the intraday staircase.
 */
export async function storeDailyMetrics(
  capability: HeatPumpCapability,
  startOfDay: Date,
  endOfDay: Date,
  cumulativeAt?: Date,
  prefetched?: PrefetchedEvents
): Promise<void> {
  const metrics = await calculateDailyHeatPumpMetrics(capability, startOfDay, endOfDay, prefetched);
  const cumulativeTimestamp = cumulativeAt ?? endOfDay;

  await Promise.all([
    capability.setDayCoPState(metrics.dayCoP, startOfDay),
    capability.setDayPowerState(metrics.dayPower, startOfDay),
    capability.setDayYieldState(metrics.dayYield, startOfDay),
    capability.setDayHeatingCoPState(metrics.heatingCoP, startOfDay),
    capability.setDayHeatingPowerState(metrics.heatingPower, startOfDay),
    capability.setDayHeatingYieldState(metrics.heatingYield, startOfDay),
    capability.setDayDHWCoPState(metrics.dhwCoP, startOfDay),
    capability.setDayDHWPowerState(metrics.dhwPower, startOfDay),
    capability.setDayDHWYieldState(metrics.dhwYield, startOfDay),
    capability.setDayCumulativePowerState(metrics.dayPower, cumulativeTimestamp),
    capability.setDayCumulativeYieldState(metrics.dayYield, cumulativeTimestamp),
    capability.setDayHeatingCumulativePowerState(metrics.heatingPower, cumulativeTimestamp),
    capability.setDayHeatingCumulativeYieldState(metrics.heatingYield, cumulativeTimestamp),
    capability.setDayDHWCumulativePowerState(metrics.dhwPower, cumulativeTimestamp),
    capability.setDayDHWCumulativeYieldState(metrics.dhwYield, cumulativeTimestamp),
  ]);
}

const INTERVAL_MS = 15 * 60 * 1000;

/**
 * Stores all metrics for a historical day in 15-minute intervals.
 * Fetches raw events once for the full day then reuses them across all 96 intervals,
 * so each interval gets the cumulative total from midnight to that point.
 * Day* properties update in-place (same startOfDay timestamp); DayCumulative*
 * get a new event at each interval endpoint, forming the staircase.
 */
async function storeDayInIntervals(
  capability: HeatPumpCapability,
  dayStart: Date,
  dayEnd: Date
): Promise<void> {
  const [powerHistory, yieldHistory, modeHistory] = await Promise.all([
    capability.getCurrentPowerHistory({ since: dayStart, until: dayEnd }),
    capability.getCurrentYieldHistory({ since: dayStart, until: dayEnd }),
    capability.getModeHistory({ since: dayStart, until: dayEnd })
  ]);
  const prefetched: PrefetchedEvents = { powerHistory, yieldHistory, modeHistory };

  for (let ms = dayStart.getTime() + INTERVAL_MS; ms <= dayEnd.getTime(); ms += INTERVAL_MS) {
    const intervalEnd = new Date(ms);
    await storeDailyMetrics(capability, dayStart, intervalEnd, intervalEnd, prefetched);
  }
}

/**
 * Ensure all historical daily metrics exist.
 * Called every 15 minutes to fill in any missing days from the last known metric to yesterday.
 * To recalculate all metrics, use the reset-daily-metrics script first.
 */
export async function ensureHistoricalMetrics(device: Device, capability: HeatPumpCapability): Promise<void> {
  // Find the latest metric event for each of the 9 Day* types
  const latestEvents = await Promise.all([
    capability.getDayCoPEvent(),
    capability.getDayPowerEvent(),
    capability.getDayYieldEvent(),
    capability.getDayHeatingCoPEvent(),
    capability.getDayHeatingPowerEvent(),
    capability.getDayHeatingYieldEvent(),
    capability.getDayDHWCoPEvent(),
    capability.getDayDHWPowerEvent(),
    capability.getDayDHWYieldEvent()
  ]);

  for (let i=0;i<latestEvents.length - 1;i++) {
    const curr = latestEvents[i];
    const next = latestEvents[i+1];

    if (curr === null && next === null) {
      continue;
    }

    if (curr === null || next === null || curr.lastReported.toISOString() !== next.lastReported.toISOString()) {
      throw new Error(`Heat Pump daily metrics have inconsistent latest timestamps. Run 'npm run reset-daily-metrics' to fix`);
    }
  }

  const endDate = dayjs().startOf('day');
  const dayMetricsStart = latestEvents[0] === null
    ? dayjs(device.createdAt).startOf('day')
    : dayjs(latestEvents[0].lastReported).startOf('day').add(1, 'day');

  for (let day = dayMetricsStart; day.isBefore(endDate); day = day.add(1, 'day')) {
    logger.info(`Calculating heat pump metrics for ${day.format('YYYY-MM-DD')}`);
    await storeDayInIntervals(capability, day.toDate(), day.add(1, 'day').toDate());
  }
}

/**
 * Calculate and store today's running metrics.
 * Day* are updated in-place (startOfDay timestamp); DayCumulative* gets a new event at now.
 */
export async function storeTodayRunningMetrics(capability: HeatPumpCapability): Promise<void> {
  const startOfDay = dayjs().startOf('day').toDate();
  const now = new Date();

  await storeDailyMetrics(capability, startOfDay, now, now);
  logger.info(`Updated today's heat pump running metrics`);
}
