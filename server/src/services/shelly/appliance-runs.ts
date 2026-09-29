import dayjs from '../../dayjs';
import type { Device } from '../../models';

export const RUN_THRESHOLD_WATTS = 20;
export const MAX_GAP_MINUTES = 20;
export const MIN_RUN_MINUTES = 30;
const CHUNK_DAYS = 1;

export type PowerReading = { start: Date; value: number };
export type ApplianceRun = { start: Date; end: Date; isOpen: boolean };

// Each reading holds until the next reading's start; the last holds until `now`.
export function detectRuns(readings: PowerReading[], now: Date): ApplianceRun[] {
  const sorted = [...readings].sort((a, b) => a.start.getTime() - b.start.getTime());
  const intervals = sorted.map((reading, i) => ({
    start: reading.start,
    end: i + 1 < sorted.length ? sorted[i + 1].start : now,
    isActive: reading.value >= RUN_THRESHOLD_WATTS
  }));

  const merged: { start: Date; end: Date }[] = [];

  for (const interval of intervals) {
    if (!interval.isActive) {
      continue;
    }

    const last = merged.at(-1);
    const gapMinutes = last ? dayjs(interval.start).diff(last.end, 'minute', true) : Infinity;

    if (last && gapMinutes < MAX_GAP_MINUTES) {
      last.end = interval.end;
    } else {
      merged.push({ start: interval.start, end: interval.end });
    }
  }

  const kept = merged.filter(run => dayjs(run.end).diff(run.start, 'minute', true) >= MIN_RUN_MINUTES);

  return kept.map((run, i) => ({
    ...run,
    isOpen: i === kept.length - 1 && dayjs(now).diff(run.end, 'minute', true) < MAX_GAP_MINUTES
  }));
}

// History also returns events that started before `since` (including every open-ended row), so each chunk is trimmed to its own start.
async function loadPowerReadings(device: Device, since: Date, until: Date): Promise<PowerReading[]> {
  const energyMonitor = device.getEnergyMonitorCapability();
  const readings: PowerReading[] = [];
  let chunkStart = dayjs(since);
  const end = dayjs(until);

  while (chunkStart.isBefore(end)) {
    const chunkEndCandidate = chunkStart.add(CHUNK_DAYS, 'day');
    const chunkEnd = chunkEndCandidate.isBefore(end) ? chunkEndCandidate : end;
    const events = await energyMonitor.getCurrentPowerHistory({ since: chunkStart.toDate(), until: chunkEnd.toDate() });
    const chunkStartMs = chunkStart.valueOf();

    for (const event of events) {
      if (event.start.getTime() >= chunkStartMs) {
        readings.push({ start: event.start, value: event.value });
      }
    }

    chunkStart = chunkEnd;
  }

  return readings;
}

export async function syncApplianceRuns(device: Device, now: Date = new Date()): Promise<void> {
  const capability = device.getApplianceCapability();
  const latestEvent = await capability.getIsRunningEvent();
  const resumeFrom = latestEvent === null
    ? device.createdAt
    : latestEvent.end ?? latestEvent.start;

  const readings = await loadPowerReadings(device, resumeFrom, now);
  const runs = detectRuns(readings, now);

  for (const run of runs) {
    if (run.isOpen) {
      await capability.setIsRunningState(true, run.start, now);
      continue;
    }

    const continuesOpenLatest = latestEvent !== null
      && latestEvent.end === null
      && run.start.getTime() === latestEvent.start.getTime();

    if (!continuesOpenLatest) {
      await capability.setIsRunningState(true, run.start, now);
    }

    await capability.setIsRunningState(false, run.end, now);
  }
}
