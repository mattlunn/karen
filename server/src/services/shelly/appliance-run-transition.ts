import dayjs from '../../dayjs';

export const RUN_THRESHOLD_WATTS = 20;
export const START_AFTER_MINUTES = 5;
export const END_AFTER_MINUTES = 10;

export type PowerReading = { start: Date; value: number };
export type RunTransition = { isRunning: boolean; at: Date };

// Each reading holds until the next one starts, so the reading in force at the window's start counts too.
export function decide(readings: PowerReading[], runStartedAt: Date | null, now: Date): RunTransition | null {
  const windowStart = dayjs(now).subtract(runStartedAt === null ? START_AFTER_MINUTES : END_AFTER_MINUTES, 'minute').toDate();
  const sorted = [...readings].sort((a, b) => a.start.getTime() - b.start.getTime());
  const inForceAtWindowStart = sorted.filter(reading => reading.start <= windowStart).at(-1);

  if (inForceAtWindowStart === undefined) {
    return null;
  }

  const window = [inForceAtWindowStart, ...sorted.filter(reading => reading.start > windowStart)];

  if (runStartedAt === null && window.every(reading => reading.value >= RUN_THRESHOLD_WATTS)) {
    return { isRunning: true, at: inForceAtWindowStart.start };
  }

  if (runStartedAt !== null && window.every(reading => reading.value < RUN_THRESHOLD_WATTS)) {
    return { isRunning: false, at: inForceAtWindowStart.start > runStartedAt ? inForceAtWindowStart.start : runStartedAt };
  }

  return null;
}
