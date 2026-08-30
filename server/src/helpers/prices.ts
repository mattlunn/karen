import { filterClampAndSortHistory } from './history';

export interface PriceSlot {
  start: Date;
  end: Date;
  pence: number;
}

// The shape `toPriceSlots` needs from a unit-rate event series - a subset of
// `NumericEvent`, kept local so this module stays pure (no model imports).
interface NumericEventLike {
  start: Date;
  end: Date | null;
  value: number;
}

export interface CheapestWindow {
  start: Date;
  end: Date;
  averagePence: number;
}

export interface SlotBlock {
  start: Date;
  end: Date;
}

/**
 * Expands a unit-rate event series into fixed-length price slots over
 * `[since, until)`. `setNumericProperty` collapses a run of equal-price
 * half-hours into one longer event, so this re-expands them into individual
 * slots - which is what makes the count-based `selectCheapestSlots` correct.
 *
 * Open events are patched and the series clamped to the window by
 * `filterClampAndSortHistory`; a partial slot at the near edge (shorter than
 * `slotMinutes`) is dropped, so slots naturally realign to the half-hour.
 */
export function toPriceSlots(
  events: NumericEventLike[],
  since: Date,
  until: Date,
  slotMinutes = 30
): PriceSlot[] {
  const slotMs = slotMinutes * 60 * 1000;
  const prepared = events
    .map(e => ({ start: e.start, end: e.end, value: e.value }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // A trailing open-ended event on a multi-rate (Agile) series is just the
  // last half-hour fetched so far, not a rate that runs to `until` - cap it at
  // one slot so no prices are fabricated past the published horizon. A lone
  // open event is a flat tariff whose rate genuinely spans the whole window,
  // so leave that for filterClampAndSortHistory to extend.
  const last = prepared.at(-1);

  if (prepared.length > 1 && last && last.end === null) {
    last.end = new Date(last.start.getTime() + slotMs);
  }

  const clamped = filterClampAndSortHistory(prepared, since, until, false);
  const slots: PriceSlot[] = [];

  for (const event of clamped) {
    const windowEnd = Math.min(event.end!.getTime(), until.getTime());
    let cursor = Math.max(event.start.getTime(), since.getTime());

    while (cursor + slotMs <= windowEnd) {
      slots.push({ start: new Date(cursor), end: new Date(cursor + slotMs), pence: event.value });
      cursor += slotMs;
    }
  }

  return slots;
}

function slotLengthMinutes(slots: PriceSlot[]): number {
  return (slots[0].end.getTime() - slots[0].start.getTime()) / 60000;
}

function withinRange(slot: PriceSlot, notBefore: Date, notAfter: Date): boolean {
  return slot.start.getTime() >= notBefore.getTime() && slot.end.getTime() <= notAfter.getTime();
}

function isContiguous(a: PriceSlot, b: PriceSlot): boolean {
  return a.end.getTime() === b.start.getTime();
}

/**
 * Slides a window of `durationMinutes` over contiguous runs of in-range slots
 * and returns the cheapest (by mean pence, ties broken on earliest start).
 * Returns null when no contiguous run is long enough - there can be gaps at
 * the edge of published data.
 */
export function findCheapestWindow(
  slots: PriceSlot[],
  durationMinutes: number,
  notBefore: Date,
  notAfter: Date
): CheapestWindow | null {
  const inRange = slots
    .filter(s => withinRange(s, notBefore, notAfter))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (inRange.length === 0) {
    return null;
  }

  const slotsNeeded = Math.ceil(durationMinutes / slotLengthMinutes(inRange));
  let best: CheapestWindow | null = null;

  for (let i = 0; i + slotsNeeded <= inRange.length; i++) {
    const window = inRange.slice(i, i + slotsNeeded);
    let contiguous = true;

    for (let j = 0; j < window.length - 1; j++) {
      if (!isContiguous(window[j], window[j + 1])) {
        contiguous = false;
        break;
      }
    }

    if (!contiguous) {
      continue;
    }

    const averagePence = window.reduce((sum, s) => sum + s.pence, 0) / window.length;

    if (best === null || averagePence < best.averagePence) {
      best = { start: window[0].start, end: window.at(-1)!.end, averagePence };
    }
  }

  return best;
}

/**
 * Picks the `slotsNeeded` cheapest in-range slots (ties broken on earliest
 * start), returned in chronological order. Unlike `findCheapestWindow` the
 * result need not be contiguous.
 */
export function selectCheapestSlots(
  slots: PriceSlot[],
  slotsNeeded: number,
  notBefore: Date,
  notAfter: Date
): PriceSlot[] {
  return slots
    .filter(s => withinRange(s, notBefore, notAfter))
    .sort((a, b) => a.pence - b.pence || a.start.getTime() - b.start.getTime())
    .slice(0, Math.max(0, slotsNeeded))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Median pence across the given slots, or null when there are none.
 */
export function medianPence(slots: PriceSlot[]): number | null {
  if (slots.length === 0) {
    return null;
  }

  const sorted = slots.map(s => s.pence).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Merges adjacent slots into contiguous blocks, discarding any block shorter
 * than `minBlockMinutes`.
 */
export function groupIntoBlocks(slots: PriceSlot[], minBlockMinutes: number): SlotBlock[] {
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const blocks: SlotBlock[] = [];

  for (const slot of sorted) {
    const last = blocks.at(-1);

    if (last && last.end.getTime() === slot.start.getTime()) {
      last.end = slot.end;
    } else {
      blocks.push({ start: slot.start, end: slot.end });
    }
  }

  return blocks.filter(b => (b.end.getTime() - b.start.getTime()) / 60000 >= minBlockMinutes);
}

/**
 * Whether the slot series contiguously covers `[since, until]` - the "do we
 * hold a full forecast for this window yet?" gate. Lenient at the near edge (a
 * sub-slot partial at `since` is unschedulable anyway); strict about the tail.
 */
export function coversWholeWindow(slots: PriceSlot[], since: Date, until: Date): boolean {
  if (slots.length === 0) {
    return false;
  }

  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const slotMs = sorted[0].end.getTime() - sorted[0].start.getTime();

  if (sorted[0].start.getTime() > since.getTime() + slotMs) {
    return false;
  }

  let cursor = sorted[0].end.getTime();

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start.getTime() > cursor) {
      break;
    }

    cursor = Math.max(cursor, sorted[i].end.getTime());
  }

  return cursor >= until.getTime();
}
