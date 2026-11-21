import dayjs from '../../dayjs';
import { isWithinWindow } from '../../helpers/date';
import { PriceSlot } from '../../helpers/prices';
import { ChargeType } from '../../models/capabilities';

export interface PlanSlot {
  start: Date;
  end: Date;
  isEstimated: boolean;
  type: ChargeType;
}

export interface ChargeDeadline {
  targetPercentage: number;
  targetTime: Date;
}

export interface ChargePlan {
  // Where the prices it was built from ran out. The plan is fixed until `now`
  // reaches this, or until prices are published past it.
  end: Date;
  // Where settled prices ran out, past which the pool is forecast.
  publishedEnd: Date;
  slots: PlanSlot[];
  deadline: Date | null;
}

export interface PlanOptions {
  // In start order, as `toPriceSlots` returns them.
  slots: PriceSlot[];
  now: Date;
  chargePercentage: number;
  schedule: ChargeDeadline | null;
  chargeRatePercentPerHour: number;
  defaultLimit: number;
  plungeLimit: number;
  deadlineEngageDays: number;
  startBufferHours: number;
}

type EngagementOptions = Omit<PlanOptions, 'slots' | 'defaultLimit' | 'plungeLimit' | 'schedule'> & {
  schedule: ChargeDeadline;
};

function hoursToCharge(from: number, to: number, ratePercentPerHour: number): number {
  return Math.max(0, to - from) / ratePercentPerHour;
}

/**
 * The instant the deadline starts being planned for: `deadlineEngageDays` before
 * it. Fixed rather than scaled to the charge needed, since the point isn't price
 * visibility (that's covered by forecast prices out to the same horizon) but
 * capping how long the car sits at its target before departure.
 */
export function deadlineEngagesAt(options: Pick<EngagementOptions, 'schedule' | 'deadlineEngageDays'>): Date {
  return dayjs(options.schedule.targetTime).subtract(options.deadlineEngageDays, 'day').toDate();
}

/**
 * Whether the deadline is being planned for. Also consulted
 * between plans, since a plan fixed while a deadline was still far off must not
 * sit frozen while it creeps into range.
 */
export function isDeadlineEngaged(options: EngagementOptions): boolean {
  return options.now < options.schedule.targetTime && options.now >= deadlineEngagesAt(options);
}

/**
 * Builds the plan for one publication, as up to three passes over forward price
 * slots. Each pass tops the same plan up to its own quota, so a slot an earlier
 * pass has already taken counts toward the next. Every slot records the pass
 * that took it, and charges only up to that pass's own target.
 * Slots beyond the ~31h Octopus itself publishes come from forecast prices
 * (`isEstimated: true`) out to `deadlineEngageDays`, so the deadline pass below
 * always has real or forecast prices for its whole window.
 *
 * 1. Business as usual: the published slots at the lowest published price,
 *    earliest first, up to what reaches `defaultLimit`. On a tariff with fixed
 *    cheap windows that's every cheap window until the car is full enough.
 *    Forecast slots are left out, since a charge booked days ahead on a guessed
 *    price stands in for one the car could take now. With a deadline engaged,
 *    only slots before it count: the car is expected to have left by then.
 * 2. Deadline, when engaged: tops the slots before the deadline up to the hours
 *    of charge still needed, cheapest first and latest first among equal prices,
 *    so the charge past `defaultLimit` sits as close to departure as it can.
 *    A picked slot that's still estimated isn't acted on until it's current, so
 *    nothing actually charges off a forecast price before real prices have had
 *    a chance to supersede it.
 * 3. Plunge, always: negative-priced slots, up to what reaches `plungeLimit`.
 *    Charging is worth it at any hour the grid is paying us to consume, so this
 *    ignores `defaultLimit`.
 */
export function planCharge(options: PlanOptions): ChargePlan {
  const {
    slots, now, chargePercentage, schedule,
    chargeRatePercentPerHour, defaultLimit, plungeLimit, startBufferHours,
  } = options;

  // Ties go to the latest slot: the car charges through its plan in time order,
  // so the extra hours a deadline charge books are best placed near the deadline.
  const pool = slots
    .filter(s => s.end > now)
    .sort((a, b) => a.pence - b.pence || b.start.getTime() - a.start.getTime());

  if (pool.length === 0) {
    return { end: now, publishedEnd: now, slots: [], deadline: null };
  }

  // The pool only ever reaches as far as real prices plus, when a deadline is
  // in range, forecast prices out to it. The plan runs exactly as far as that
  // and is rebuilt when it extends, so placement within it is genuinely
  // optimal: the unknown future only sets the length.
  const end = slots.at(-1)!.end;
  const publishedEnd = slots.findLast(s => !s.isEstimated)?.end ?? now;

  const slotHours = dayjs(pool[0].end).diff(pool[0].start, 'hour', true);
  const picked = new Map<PriceSlot, ChargeType>();

  function take(candidates: PriceSlot[], count: number, type: ChargeType): void {
    for (const slot of candidates.filter(s => !picked.has(s)).slice(0, Math.max(0, count))) {
      picked.set(slot, type);
    }
  }

  function slotsToCharge(percentage: number): number {
    return Math.ceil(hoursToCharge(chargePercentage, percentage, chargeRatePercentPerHour) / slotHours);
  }

  const deadline = schedule !== null && isDeadlineEngaged({ ...options, schedule }) ? schedule.targetTime : null;
  const isBeforeDeadline = (s: PriceSlot) => deadline === null || s.end <= deadline;
  const published = slots.filter(s => s.end > now && !s.isEstimated);
  const cheapestPublished = Math.min(...published.map(s => s.pence));

  take(
    published.filter(s => s.pence === cheapestPublished && isBeforeDeadline(s)),
    slotsToCharge(defaultLimit), 'BAU',
  );

  if (schedule !== null && deadline !== null) {
    const chargeHours = hoursToCharge(chargePercentage, schedule.targetPercentage, chargeRatePercentPerHour);

    if (chargeHours > 0) {
      const quota = Math.ceil((chargeHours + startBufferHours) / slotHours);

      take(pool.filter(isBeforeDeadline), quota - picked.size, 'DEADLINE');
    }
  }

  take(pool.filter(s => s.pence < 0), slotsToCharge(plungeLimit) - picked.size, 'PLUNGE');

  return {
    end,
    publishedEnd,
    slots: [...picked]
      .sort(([a], [b]) => a.start.getTime() - b.start.getTime())
      .map(([s, type]) => ({ start: s.start, end: s.end, isEstimated: s.isEstimated, type })),
    deadline,
  };
}

export function findActiveSlot(slots: PlanSlot[], now: Date): PlanSlot | undefined {
  return slots.find(s => isWithinWindow(s, now));
}
