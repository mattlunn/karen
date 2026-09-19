import dayjs from '../../dayjs';
import { isWithinWindow } from '../../helpers/date';
import { PriceSlot } from '../../helpers/prices';

export interface PlanSlot {
  start: Date;
  end: Date;
  isEstimated: boolean;
}

export interface ChargeDeadline {
  targetPercentage: number;
  targetTime: Date;
}

export interface ChargePlan {
  // Where the prices it was built from ran out. The plan is fixed until `now`
  // reaches this, or until prices are published past it.
  end: Date;
  slots: PlanSlot[];
  // The SoC ceiling to charge toward: the highest of the passes that contributed.
  target: number;
  // Set only by the deadline pass, and drives the not-charging alert.
  deadline: Date | null;
}

export interface PlanOptions {
  // In start order, as `toPriceSlots` returns them.
  slots: PriceSlot[];
  now: Date;
  chargePercentage: number;
  baselinePence: number | null;
  schedule: ChargeDeadline | null;
  chargeRatePercentPerHour: number;
  defaultLimit: number;
  plungeLimit: number;
  deadlineEngageDays: number;
  startBufferHours: number;
}

type EngagementOptions = Omit<PlanOptions, 'slots' | 'baselinePence' | 'defaultLimit' | 'plungeLimit' | 'schedule'> & {
  schedule: ChargeDeadline;
};

function hoursToCharge(from: number, to: number, ratePercentPerHour: number): number {
  return Math.max(0, to - from) / ratePercentPerHour;
}

/**
 * Whether a scheduled charge is close enough to take over from opportunistic
 * charging: within `deadlineEngageDays` of the deadline. Fixed rather than
 * scaled to the charge needed, since the point isn't price visibility (that's
 * covered by forecast prices out to the same horizon) but capping how long
 * the car sits at its target before departure.
 *
 * Also consulted between plans, since a plan fixed while a deadline was still
 * far off must not sit frozen while it creeps into range.
 */
export function isDeadlineEngaged(options: EngagementOptions): boolean {
  const { schedule, now, deadlineEngageDays } = options;
  const hoursToDeadline = dayjs(schedule.targetTime).diff(now, 'hour', true);

  return hoursToDeadline > 0 && hoursToDeadline <= deadlineEngageDays * 24;
}

/**
 * Builds the plan for one publication, as up to three passes over a single pool of
 * forward price slots sorted cheapest-first. Each pass tops the same plan up to
 * its own quota, so a slot one pass has already taken counts toward the next.
 * Slots beyond the ~31h Octopus itself publishes come from forecast prices
 * (`isEstimated: true`) out to `deadlineEngageDays`, so the deadline pass below
 * always has real or forecast prices for its whole window.
 *
 * 1. Deadline, when engaged: the cheapest slots falling before the deadline, up
 *    to exactly the hours of charge still needed. Slots this picks that are
 *    still estimated get re-picked from fresh data on every replan, so nothing
 *    is truly committed until real prices supersede the forecast.
 * 2. Business as usual, otherwise: the cheapest slots priced under the trailing
 *    median, up to what reaches `defaultLimit`. Judging cheap against recent
 *    history rather than a percentile of the publication means a uniformly cheap day
 *    charges freely while an expensive day charges only in the dips.
 * 3. Plunge, always: negative-priced slots, up to what reaches `plungeLimit`.
 *    Charging is worth it at any hour the grid is paying us to consume, so this
 *    ignores both the baseline and `defaultLimit`.
 */
export function planCharge(options: PlanOptions): ChargePlan {
  const {
    slots, now, chargePercentage, baselinePence, schedule,
    chargeRatePercentPerHour, defaultLimit, plungeLimit, startBufferHours,
  } = options;

  const pool = slots
    .filter(s => s.end > now)
    .sort((a, b) => a.pence - b.pence || a.start.getTime() - b.start.getTime());

  if (pool.length === 0) {
    return { end: now, slots: [], target: defaultLimit, deadline: null };
  }

  // The pool only ever reaches as far as real prices plus, when a deadline is
  // in range, forecast prices out to it. The plan runs exactly as far as that
  // and is rebuilt when it extends, so placement within it is genuinely
  // optimal: the unknown future only sets the length.
  const end = slots.at(-1)!.end;

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

    take(s => s.end <= schedule.targetTime, Math.ceil(hoursNeeded / slotHours));

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
    end,
    slots: [...picked]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map(s => ({ start: s.start, end: s.end, isEstimated: s.isEstimated ?? false })),
    target,
    deadline,
  };
}

export function isWithinSlots(slots: PlanSlot[], now: Date): boolean {
  return slots.some(s => isWithinWindow(s, now));
}
