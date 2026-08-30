import {
  PriceSlot,
  SlotBlock,
  selectCheapestSlots,
  groupIntoBlocks,
} from '../../helpers/prices';

export type Block = SlotBlock;

export interface DeadlinePlan {
  // The far edge of the window this plan commits to; not recomputed until
  // `now` reaches it.
  windowEnd: Date;
  blocks: Block[];
}

const MS_PER_HOUR = 60 * 60 * 1000;

function slotMinutesOf(slots: PriceSlot[]): number {
  return (slots[0].end.getTime() - slots[0].start.getTime()) / 60_000;
}

function endOfPublishedPrices(slots: PriceSlot[]): Date {
  return slots.reduce((max, s) => (s.end.getTime() > max.getTime() ? s.end : max), slots[0].end);
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
  const hoursToDeadline = (deadline.getTime() - now.getTime()) / MS_PER_HOUR;

  if (hoursNeeded <= 0) {
    return { windowEnd: deadline, blocks: [] };
  }

  if (hoursToDeadline <= hoursNeeded) {
    return { windowEnd: deadline, blocks: [{ start: now, end: deadline }] };
  }

  if (slots.length === 0) {
    return { windowEnd: now, blocks: [] };
  }

  const windowEnd = new Date(Math.min(endOfPublishedPrices(slots).getTime(), deadline.getTime()));
  const windowHours = (windowEnd.getTime() - now.getTime()) / MS_PER_HOUR;

  if (windowHours <= 0) {
    return { windowEnd, blocks: [] };
  }

  const share = hoursNeeded * (windowHours / hoursToDeadline);
  const slotsNeeded = Math.ceil((share * 60) / slotMinutesOf(slots));

  const picked = selectCheapestSlots(slots, slotsNeeded, now, windowEnd);

  return { windowEnd, blocks: groupIntoBlocks(picked, minBlockMinutes) };
}

/**
 * Business-as-usual charging: charge through every upcoming slot priced below
 * `baselinePence` (the trailing-median unit rate). Judging "cheap" against
 * recent history rather than a percentile of the next 24h means a uniformly
 * cheap day charges freely while an expensive day charges only in the dips.
 */
export function planOpportunisticCharge(
  slots: PriceSlot[],
  now: Date,
  baselinePence: number,
  minBlockMinutes: number,
): Block[] {
  const cheap = slots.filter(s => s.end.getTime() > now.getTime() && s.pence < baselinePence);

  return groupIntoBlocks(cheap, minBlockMinutes);
}

export function isWithinBlocks(blocks: Block[], now: Date): boolean {
  return blocks.some(b => now.getTime() >= b.start.getTime() && now.getTime() < b.end.getTime());
}
