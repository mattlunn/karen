import dayjs from '../../dayjs';
import { NumericEvent, StringEvent } from '../../models/event';
import { HeatPumpMode, HeatPumpCapability } from '../../models/capabilities';
import { filterClampAndSortHistory } from '../../helpers/history';
import { calculateWattHours } from '../../helpers/energy';
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
  modeHistory: StringEvent[],
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
 * Calculates COP from power and yield values
 */
export function calculateCoP(powerValue: number, yieldValue: number): number {
  return Math.round(powerValue > 0 ? ((powerValue + yieldValue) / powerValue) * 100 : 0) / 100;
}

const INTERVAL_MS = 15 * 60 * 1000;

function computeIntervalMetrics(
  powerHistory: NumericEvent[],
  yieldHistory: NumericEvent[],
  modeHistory: StringEvent[],
  dayStart: Date,
  intervalEnd: Date
): IntervalMetrics {
  const clampedPower = filterClampAndSortHistory(powerHistory, dayStart, intervalEnd, false);
  const clampedYield = filterClampAndSortHistory(yieldHistory, dayStart, intervalEnd, false);
  const clampedMode = filterClampAndSortHistory(modeHistory, dayStart, intervalEnd, false);

  function computeSegment(modes: HeatPumpMode[]): SegmentMetrics {
    const windows = getModeWindows(clampedMode, modes);
    const power = calculateWattHours(filterEventsToModeWindows(clampedPower, windows));
    const yield_ = calculateWattHours(filterEventsToModeWindows(clampedYield, windows));
    return { power, yield: yield_, coP: calculateCoP(power, yield_) };
  }

  return {
    total:   computeSegment(['HEATING', 'DHW']),
    heating: computeSegment(['HEATING']),
    dhw:     computeSegment(['DHW']),
  };
}

async function storeIntervalMetrics(
  capability: HeatPumpCapability,
  { total, heating, dhw }: IntervalMetrics,
  dayStart: Date,
  intervalStart: Date,
  intervalEnd: Date
): Promise<void> {
  await Promise.all([
    // DayCumulative*: one event per 15-min window (stateTimestamp = window start, reportedAt = window end)
    capability.setDayCumulativePowerState(total.power, intervalStart, intervalEnd),
    capability.setDayCumulativeYieldState(total.yield, intervalStart, intervalEnd),
    capability.setDayHeatingCumulativePowerState(heating.power, intervalStart, intervalEnd),
    capability.setDayHeatingCumulativeYieldState(heating.yield, intervalStart, intervalEnd),
    capability.setDayDHWCumulativePowerState(dhw.power, intervalStart, intervalEnd),
    capability.setDayDHWCumulativeYieldState(dhw.yield, intervalStart, intervalEnd),
    // Day* summary: one event per day, updated in place every interval (stateTimestamp = dayStart, reportedAt = intervalEnd)
    capability.setDayCoPState(total.coP, dayStart, intervalEnd),
    capability.setDayPowerState(total.power, dayStart, intervalEnd),
    capability.setDayYieldState(total.yield, dayStart, intervalEnd),
    capability.setDayHeatingCoPState(heating.coP, dayStart, intervalEnd),
    capability.setDayHeatingPowerState(heating.power, dayStart, intervalEnd),
    capability.setDayHeatingYieldState(heating.yield, dayStart, intervalEnd),
    capability.setDayDHWCoPState(dhw.coP, dayStart, intervalEnd),
    capability.setDayDHWPowerState(dhw.power, dayStart, intervalEnd),
    capability.setDayDHWYieldState(dhw.yield, dayStart, intervalEnd),
  ]);
}

export async function calculateDailyHeatPumpMetrics(
  capability: HeatPumpCapability,
  dayStart: Date,
  dayEnd: Date,
  resumeFrom: Date
): Promise<void> {
  const snappedDayEnd = new Date(Math.floor(dayEnd.getTime() / INTERVAL_MS) * INTERVAL_MS);
  if (snappedDayEnd.getTime() <= dayStart.getTime()) return;

  const startMs = resumeFrom.getTime() + INTERVAL_MS;
  if (startMs > snappedDayEnd.getTime()) return;

  const [powerHistory, yieldHistory, modeHistory] = await Promise.all([
    capability.getCurrentPowerHistory({ since: dayStart, until: snappedDayEnd }),
    capability.getCurrentYieldHistory({ since: dayStart, until: snappedDayEnd }),
    capability.getModeHistory({ since: dayStart, until: snappedDayEnd }),
  ]);

  for (let ms = startMs; ms <= snappedDayEnd.getTime(); ms += INTERVAL_MS) {
    const intervalStart = new Date(ms - INTERVAL_MS);
    const intervalEnd = new Date(ms);
    const metrics = computeIntervalMetrics(powerHistory, yieldHistory, modeHistory, dayStart, intervalEnd);
    await storeIntervalMetrics(capability, metrics, dayStart, intervalStart, intervalEnd);
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

  for (let day = dayMetricsStart; day.isSameOrBefore(today); day = day.add(1, 'day').startOf('day')) {
    const dayStart = day.toDate();
    const dayEnd = day.isSame(today, 'day') ? now : day.add(1, 'day').startOf('day').toDate();
    const resumeFrom = (latestTimestamp !== null && latestTimestamp > dayStart && latestTimestamp < dayEnd)
      ? latestTimestamp
      : dayStart;

    logger.info(`Processing heat pump metrics for ${day.format('YYYY-MM-DD')}`);
    await calculateDailyHeatPumpMetrics(capability, dayStart, dayEnd, resumeFrom);
  }
}
