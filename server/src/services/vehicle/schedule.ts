import dayjs, { Dayjs } from '../../dayjs';
import { getNextOccurrence } from '../../helpers/recurrence';
import { humanDate } from '../../helpers/date';

export interface ChargeScheduleConfig {
  target_percentage: number;
  target_time_of_day: string;
  anchor_date: string;
  interval_weeks: number;
}

export interface NextChargeOccurrence {
  targetPercentage: number;
  targetTime: Dayjs;
}

export function pickNextChargeSchedule(
  schedules: ChargeScheduleConfig[],
  now: Dayjs,
): NextChargeOccurrence | null {
  const candidates = schedules.map(s => {
    const day = getNextOccurrence(s.anchor_date, s.interval_weeks, now);
    const [hh, mm] = s.target_time_of_day.split(':').map(Number);
    let target = day.hour(hh).minute(mm).second(0).millisecond(0);

    if (target.isBefore(now)) {
      target = target.add(s.interval_weeks * 7, 'day');
    }

    return {
      targetPercentage: s.target_percentage,
      targetTime: target,
    };
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => a.targetTime.diff(b.targetTime));
  return candidates[0];
}

export function buildScheduleNotification(
  targetPercentage: number,
  startTime: Dayjs,
  targetTime: Dayjs,
  cableConnected: boolean,
): string {
  const startStr = `${startTime.format('HH:mm')} ${humanDate(startTime)}`;
  const targetStr = `${targetTime.format('HH:mm')} ${humanDate(targetTime)}`;
  const tail = `scheduled charge start at ${startStr} and get to ${targetPercentage}% by ${targetStr}`;

  return cableConnected
    ? `Car charging started: ${tail}`
    : `Car needs to be plugged in to allow ${tail}`;
}

export function buildChargingFailureNotification(
  targetPercentage: number,
  targetTime: Dayjs,
): string {
  const targetStr = `${targetTime.format('HH:mm')} ${humanDate(targetTime)}`;

  return `Car is plugged in but not charging; it won't reach ${targetPercentage}% by ${targetStr}. Please check it.`;
}
