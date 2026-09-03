import dayjs from '../../dayjs';
import { isWithinWindow } from '../../helpers/date';
import {
  PriceSlot,
  SlotBlock,
  selectCheapestSlots,
  findCheapestWindow,
  groupIntoBlocks,
} from '../../helpers/prices';

export type Block = SlotBlock;

export interface DeadlinePlan {
  // The far edge of the window this plan commits to; not recomputed until
  // `now` reaches it.
  windowEnd: Date;
  blocks: Block[];
}

function slotMinutesOf(slots: PriceSlot[]): number {
  return dayjs(slots[0].end).diff(slots[0].start, 'minute', true);
}

// toPriceSlots returns slots in ascending, contiguous order, so the last slot's
// end is the end of the published horizon.
function endOfPublishedPrices(slots: PriceSlot[]): Date {
  return slots[slots.length - 1].end;
}

/**
 * Plans one committed window of a deadline charge. Only ~31h of Agile prices
 * are ever published, so a deadline further out is planned a window at a time:
 * take a pro-rata share of the remaining work, place it optimally *within the
 * fully-published window*, and don't recompute until the window rolls over.
 *
 * Because the window is bounded by the published horizon, prices are fully
 * known across it, so "cheapest within the window" is genuinely optimal - the
 * unknown future only sets the window's length, never the placement.
 *
 * The deadline always beats cost: with no slack left
 * (`deadline - now <= hoursNeeded`) prices are ignored and the plan is a
 * single continuous block to the deadline.
 */
export function planDeadlineCharge(
  slots: PriceSlot[],
  hoursNeeded: number,
  now: Date,
  deadline: Date,
  minBlockMinutes: number,
): DeadlinePlan {
  const hoursToDeadline = dayjs(deadline).diff(now, 'hour', true);

  if (hoursNeeded <= 0) {
    return { windowEnd: deadline, blocks: [] };
  }

  if (hoursToDeadline <= hoursNeeded) {
    return { windowEnd: deadline, blocks: [{ start: now, end: deadline }] };
  }

  if (slots.length === 0) {
    return { windowEnd: now, blocks: [] };
  }

  const publishedEnd = endOfPublishedPrices(slots);
  const windowEnd = publishedEnd < deadline ? publishedEnd : deadline;
  const windowHours = dayjs(windowEnd).diff(now, 'hour', true);

  if (windowHours <= 0) {
    return { windowEnd, blocks: [] };
  }

  const share = hoursNeeded * (windowHours / hoursToDeadline);
  const slotsNeeded = Math.ceil((share * 60) / slotMinutesOf(slots));

  const picked = selectCheapestSlots(slots, slotsNeeded, now, windowEnd);

  return { windowEnd, blocks: groupIntoBlocks(picked, minBlockMinutes) };
}

/**
 * Business-as-usual charging: of the upcoming slots priced below
 * `baselinePence` (the trailing-median unit rate), charge through the cheapest
 * `hoursNeeded`-worth. Judging "cheap" against recent history rather than a
 * percentile of the next 24h means a uniformly cheap day charges freely while
 * an expensive day charges only in the dips; capping at what the car actually
 * needs then keeps it out of the dearer end of that set.
 *
 * Selection is by whole `minBlockMinutes` runs, not by individual slot, because
 * `groupIntoBlocks` discards anything shorter: the cheapest slots are usually
 * not adjacent, so picking them individually leaves a small top-up with nothing
 * to charge through, on every tick until prices roll. Rounding up to whole
 * blocks can overshoot `hoursNeeded`, which `applyChargeBlocks` bounds.
 */
export function planOpportunisticCharge(
  slots: PriceSlot[],
  now: Date,
  baselinePence: number,
  minBlockMinutes: number,
  hoursNeeded: number,
): Block[] {
  const cheap = slots.filter(s => s.end > now && s.pence < baselinePence);

  if (cheap.length === 0 || hoursNeeded <= 0) {
    return [];
  }

  const slotsNeeded = Math.ceil((hoursNeeded * 60) / slotMinutesOf(cheap));
  const picked: PriceSlot[] = [];
  let pool = cheap;

  while (picked.length < slotsNeeded) {
    const window = findCheapestWindow(pool, minBlockMinutes, pool[0].start, pool.at(-1)!.end);

    if (window === null) {
      break;
    }

    picked.push(...pool.filter(s => s.start >= window.start && s.end <= window.end));
    pool = pool.filter(s => s.end <= window.start || s.start >= window.end);

    if (pool.length === 0) {
      break;
    }
  }

  return groupIntoBlocks(picked, minBlockMinutes);
}

// Negative-price windows: charge through them regardless of the BAU ceiling or
// the cheap-baseline test. Runs shorter than minBlockMinutes are dropped, same
// as the other planners.
export function planPlungeCharge(slots: PriceSlot[], now: Date, minBlockMinutes: number): Block[] {
  return groupIntoBlocks(slots.filter(s => s.end > now && s.pence < 0), minBlockMinutes);
}

// Coalesces overlapping or touching blocks into a minimal set, so a plunge
// window layered onto a base plan doesn't paint the same span twice.
export function mergeBlocks(blocks: Block[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Block[] = [];

  for (const block of sorted) {
    const last = merged.at(-1);

    if (last && block.start.getTime() <= last.end.getTime()) {
      if (block.end.getTime() > last.end.getTime()) {
        last.end = block.end;
      }
    } else {
      merged.push({ start: block.start, end: block.end });
    }
  }

  return merged;
}

export function isWithinBlocks(blocks: Block[], now: Date): boolean {
  return blocks.some(b => isWithinWindow(b, now));
}
