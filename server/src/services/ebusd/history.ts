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

interface SegmentMetrics {
  power: number;
  yield: number;
  coP: number;
}

interface IntervalMetrics {
  total: SegmentMetrics;
  heating: SegmentMetrics;
  dhw: SegmentMetrics;
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

const INTERVAL_MS = 15 * 60 * 1000;

function computeIntervalMetrics(
  powerHistory: NumericEvent[],
  yieldHistory: NumericEvent[],
  modeHistory: NumericEvent[],
  dayStart: Date,
  intervalEnd: Date
): IntervalMetrics {
  const clampedPower = clampAndSortHistory(powerHistory, dayStart, intervalEnd, false);
  const clampedYield = clampAndSortHistory(yieldHistory, dayStart, intervalEnd, false);
  const clampedMode = clampAndSortHistory(modeHistory, dayStart, intervalEnd, false);

  function computeSegment(modes: HeatPumpMode[]): SegmentMetrics {
    const windows = getModeWindows(clampedMode, modes);
    const power = calculateWattHours(filterEventsToModeWindows(clampedPower, windows));
    const yield_ = calculateWattHours(filterEventsToModeWindows(clampedYield, windows));
    return { power, yield: yield_, coP: calculateCoP(power, yield_) };
  }

  return {
    total:   computeSegment([HeatPumpMode.HEATING, HeatPumpMode.DHW]),
    heating: computeSegment([HeatPumpMode.HEATING]),
    dhw:     computeSegment([HeatPumpMode.DHW]),
  };
}

async function storeIntervalMetrics(
  capability: HeatPumpCapability,
  { total, heating, dhw }: IntervalMetrics,
  intervalEnd: Date,
  isLastInterval: boolean
): Promise<void> {
  await Promise.all([
    capability.setDayCumulativePowerState(total.power, intervalEnd),
    capability.setDayCumulativeYieldState(total.yield, intervalEnd),
    capability.setDayHeatingCumulativePowerState(heating.power, intervalEnd),
    capability.setDayHeatingCumulativeYieldState(heating.yield, intervalEnd),
    capability.setDayDHWCumulativePowerState(dhw.power, intervalEnd),
    capability.setDayDHWCumulativeYieldState(dhw.yield, intervalEnd),
  ]);

  if (isLastInterval) {
    await Promise.all([
      capability.setDayCoPState(total.coP, intervalEnd),
      capability.setDayPowerState(total.power, intervalEnd),
      capability.setDayYieldState(total.yield, intervalEnd),
      capability.setDayHeatingCoPState(heating.coP, intervalEnd),
      capability.setDayHeatingPowerState(heating.power, intervalEnd),
      capability.setDayHeatingYieldState(heating.yield, intervalEnd),
      capability.setDayDHWCoPState(dhw.coP, intervalEnd),
      capability.setDayDHWPowerState(dhw.power, intervalEnd),
      capability.setDayDHWYieldState(dhw.yield, intervalEnd),
    ]);
  }
}

export async function calculateDailyHeatPumpMetrics(
  capability: HeatPumpCapability,
  dayStart: Date,
  dayEnd: Date,
  startMs: number
): Promise<void> {
  const [powerHistory, yieldHistory, modeHistory] = await Promise.all([
    capability.getCurrentPowerHistory({ since: dayStart, until: dayEnd }),
    capability.getCurrentYieldHistory({ since: dayStart, until: dayEnd }),
    capability.getModeHistory({ since: dayStart, until: dayEnd }),
  ]);

  for (let ms = startMs; ms <= dayEnd.getTime(); ms += INTERVAL_MS) {
    const intervalEnd = new Date(ms);
    const metrics = computeIntervalMetrics(powerHistory, yieldHistory, modeHistory, dayStart, intervalEnd);
    await storeIntervalMetrics(capability, metrics, intervalEnd, ms === dayEnd.getTime());
  }
}

export async function storeRunningMetrics(device: Device, capability: HeatPumpCapability): Promise<void> {
  const latestEvents = await Promise.all([
    capability.getDayCoPEvent(),
    capability.getDayPowerEvent(),
    capability.getDayYieldEvent(),
    capability.getDayHeatingCoPEvent(),
    capability.getDayHeatingPowerEvent(),
    capability.getDayHeatingYieldEvent(),
    capability.getDayDHWCoPEvent(),
    capability.getDayDHWPowerEvent(),
    capability.getDayDHWYieldEvent(),
    capability.getDayCumulativePowerEvent(),
    capability.getDayCumulativeYieldEvent(),
    capability.getDayHeatingCumulativePowerEvent(),
    capability.getDayHeatingCumulativeYieldEvent(),
    capability.getDayDHWCumulativePowerEvent(),
    capability.getDayDHWCumulativeYieldEvent(),
  ]);

  for (let i = 0; i < latestEvents.length - 1; i++) {
    const curr = latestEvents[i];
    const next = latestEvents[i + 1];
    if (curr === null && next === null) continue;
    if (curr === null || next === null || curr.lastReported.toISOString() !== next.lastReported.toISOString()) {
      throw new Error(`Heat Pump daily metrics have inconsistent latest timestamps. Run 'npm run reset-daily-metrics' to fix`);
    }
  }

  const latestTimestamp = latestEvents[0]?.lastReported ?? null;
  const now = new Date();
  const today = dayjs(now).startOf('day');
  const dayMetricsStart = latestTimestamp === null
    ? dayjs(device.createdAt).startOf('day')
    : dayjs(latestTimestamp).startOf('day');

  for (let day = dayMetricsStart; day.isSameOrBefore(today); day = day.add(1, 'day')) {
    const dayStart = day.toDate();
    const isToday = day.isSame(today, 'day');
    const dayEnd = isToday
      ? new Date(Math.floor(now.getTime() / INTERVAL_MS) * INTERVAL_MS)
      : day.add(1, 'day').toDate();

    if (dayEnd.getTime() <= dayStart.getTime()) continue;

    const dayHasPartialData = latestTimestamp !== null
      && latestTimestamp > dayStart
      && latestTimestamp < dayEnd;
    const startMs = dayHasPartialData
      ? latestTimestamp.getTime() + INTERVAL_MS
      : dayStart.getTime() + INTERVAL_MS;

    if (startMs > dayEnd.getTime()) continue;

    logger.info(`Processing heat pump metrics for ${day.format('YYYY-MM-DD')}`);
    await calculateDailyHeatPumpMetrics(capability, dayStart, dayEnd, startMs);
  }
}
