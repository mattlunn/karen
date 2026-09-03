import dayjs from '../../dayjs';
import { isWithinWindow } from '../../helpers/date';
import { PriceSlot } from '../../helpers/prices';

export interface PlanSlot {
  start: Date;
  end: Date;
}

export interface ChargeDeadline {
  targetPercentage: number;
  targetTime: Date;
}

export interface ChargePlan {
  // The plan is fixed until `now` reaches this.
  horizonEnd: Date;
  slots: PlanSlot[];
  // The SoC ceiling to charge toward: the highest of the passes that contributed.
  target: number;
  // Set only by the deadline pass, and drives the not-charging alert.
  deadline: Date | null;
}

export interface PlanOptions {
  slots: PriceSlot[];
  now: Date;
  horizonEnd: Date;
  chargePercentage: number;
  baselinePence: number | null;
  schedule: ChargeDeadline | null;
  chargeRatePercentPerHour: number;
  defaultLimit: number;
  plungeLimit: number;
  deadlineEngageFraction: number;
  startBufferHours: number;
}

type EngagementOptions = Omit<PlanOptions, 'slots' | 'horizonEnd' | 'baselinePence' | 'defaultLimit' | 'plungeLimit' | 'schedule'> & {
  schedule: ChargeDeadline;
};

function hoursToCharge(from: number, to: number, ratePercentPerHour: number): number {
  return Math.max(0, to - from) / ratePercentPerHour;
}

/**
 * Whether a scheduled charge is close enough to take over from opportunistic
 * charging: when it would need `deadlineEngageFraction` of the time still left.
 * That scales with how much charge is actually needed, so an 80%->100% top-up
 * engages far later than a 15%->100% charge with the same deadline.
 *
 * Also consulted between plans, since a plan fixed while a deadline was still
 * far off must not sit frozen while it creeps into range.
 */
export function isDeadlineEngaged(options: EngagementOptions): boolean {
  const { schedule, now, chargePercentage, chargeRatePercentPerHour, startBufferHours } = options;
  const hoursNeeded = hoursToCharge(chargePercentage, schedule.targetPercentage, chargeRatePercentPerHour) + startBufferHours;
  const hoursToDeadline = dayjs(schedule.targetTime).diff(now, 'hour', true);

  return hoursToDeadline > 0 && hoursNeeded / hoursToDeadline >= options.deadlineEngageFraction;
}

/**
 * Builds the plan for one horizon, as up to three passes over a single pool of
 * forward price slots sorted cheapest-first. Each pass tops the same plan up to
 * its own quota, so a slot one pass has already taken counts toward the next.
 *
 * 1. Deadline, when engaged: the cheapest slots falling before the deadline, up
 *    to a pro-rata share of the work. Only ~31h of Agile prices are ever
 *    published, so a deadline beyond the horizon is charged a horizon at a time.
 *    With no slack left the share saturates and this takes every slot before the
 *    deadline, which is the deadline beating cost.
 * 2. Business as usual, otherwise: the cheapest slots priced under the trailing
 *    median, up to what reaches `defaultLimit`. Judging cheap against recent
 *    history rather than a percentile of the horizon means a uniformly cheap day
 *    charges freely while an expensive day charges only in the dips.
 * 3. Plunge, always: negative-priced slots, up to what reaches `plungeLimit`.
 *    Charging is worth it at any hour the grid is paying us to consume, so this
 *    ignores both the baseline and `defaultLimit`.
 */
export function planCharge(options: PlanOptions): ChargePlan {
  const {
    slots, now, horizonEnd, chargePercentage, baselinePence, schedule,
    chargeRatePercentPerHour, defaultLimit, plungeLimit, startBufferHours,
  } = options;

  const pool = slots
    .filter(s => s.end > now)
    .sort((a, b) => a.pence - b.pence || a.start.getTime() - b.start.getTime());

  if (pool.length === 0) {
    return { horizonEnd, slots: [], target: defaultLimit, deadline: null };
  }

  const slotHours = dayjs(pool[0].end).diff(pool[0].start, 'hour', true);
  const picked = new Set<PriceSlot>();

  function take(predicate: (slot: PriceSlot) => boolean, quotaSlots: number): number {
    let added = 0;

    for (const slot of pool) {
      if (picked.size >= quotaSlots) {
        break;
      }

      if (!picked.has(slot) && predicate(slot)) {
        picked.add(slot);
        added++;
      }
    }

    return added;
  }

  function quotaFor(percentage: number): number {
    return Math.ceil(hoursToCharge(chargePercentage, percentage, chargeRatePercentPerHour) / slotHours);
  }

  let target = defaultLimit;
  let deadline: Date | null = null;

  if (schedule !== null && isDeadlineEngaged({ ...options, schedule })) {
    const hoursNeeded = hoursToCharge(chargePercentage, schedule.targetPercentage, chargeRatePercentPerHour) + startBufferHours;
    const hoursToDeadline = dayjs(schedule.targetTime).diff(now, 'hour', true);
    const horizonHours = dayjs(horizonEnd).diff(now, 'hour', true);
    const share = hoursNeeded * Math.min(1, horizonHours / hoursToDeadline);

    take(s => s.end <= schedule.targetTime, Math.ceil(share / slotHours));

    target = schedule.targetPercentage;
    deadline = schedule.targetTime;
  }

  if (deadline === null && baselinePence !== null) {
    take(s => s.pence < baselinePence, quotaFor(defaultLimit));
  }

  if (take(s => s.pence < 0, quotaFor(plungeLimit)) > 0) {
    target = Math.max(target, plungeLimit);
  }

  return {
    horizonEnd,
    slots: [...picked]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map(s => ({ start: s.start, end: s.end })),
    target,
    deadline,
  };
}

export function isWithinSlots(slots: PlanSlot[], now: Date): boolean {
  return slots.some(s => isWithinWindow(s, now));
}
