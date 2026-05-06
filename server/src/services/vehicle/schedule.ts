import dayjs, { Dayjs } from '../../dayjs';
import { getNextOccurrence } from '../../helpers/recurrence';
import { humanDate } from '../../helpers/date';
import { ManualChargeSchedule } from '../../models/capabilities';

export interface ChargeScheduleConfig {
  id: string;
  targetPercentage: number;
  targetTimeOfDay: string;
  anchorDate: string;
  intervalWeeks: number;
}

export interface NextChargeOccurrence {
  targetPercentage: number;
  targetTime: Dayjs;
}

export function pickNextChargeSchedule(
  schedules: ChargeScheduleConfig[],
  manual: ManualChargeSchedule | null,
  now: Dayjs,
): NextChargeOccurrence | null {
  if (manual && dayjs(manual.targetTime).isAfter(now)) {
    return {
      targetPercentage: manual.targetPercentage,
      targetTime: dayjs(manual.targetTime),
    };
  }

  const candidates = schedules.map(s => {
    const day = getNextOccurrence(s.anchorDate, s.intervalWeeks, now);
    const [hh, mm] = s.targetTimeOfDay.split(':').map(Number);
    let target = day.hour(hh).minute(mm).second(0).millisecond(0);

    if (target.isBefore(now)) {
      target = target.add(s.intervalWeeks * 7, 'day');
    }

    return {
      targetPercentage: s.targetPercentage,
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
