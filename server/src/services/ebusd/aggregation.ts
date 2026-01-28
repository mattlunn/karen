import dayjs from '../../dayjs';
import { NumericEvent } from '../../models/event';
import { HeatPumpMode, HeatPumpCapability } from '../../models/capabilities';
import { clampAndSortHistory } from '../../helpers/history';

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
 * Extracts time windows where mode matches any of the specified values
 */
export function getModeWindows(
  modeHistory: NumericEvent[],
  modes: HeatPumpMode[]
): TimeWindow[] {
  return modeHistory
    .filter(event => modes.includes(event.value as HeatPumpMode))
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
