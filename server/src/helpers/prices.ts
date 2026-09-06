export const SLOT_MINUTES = 30;

export interface PriceSlot {
  start: Date;
  end: Date;
  pence: number;
  // Set by a caller that backfilled this slot from a prior period; toPriceSlots never sets it.
  isEstimated?: boolean;
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

export function startOfSlot(date: Date, slotMinutes = SLOT_MINUTES): Date {
  const slotMs = slotMinutes * 60 * 1000;

  return new Date(Math.floor(date.getTime() / slotMs) * slotMs);
}

/**
 * Expands a unit-rate event series into fixed-length price slots over
 * `[since, until)`. `setNumericProperty` collapses a run of equal-price
 * half-hours into one longer event, so this re-expands them into individual
 * slots - which is what makes count-based slot selection correct.
 *
 * The series is contiguous by construction (Octopus writes forward-dated,
 * back-to-back rates), so the only open event is the frontier: on a multi-rate
 * series it is the latest half-hour fetched, worth one slot; a lone open event
 * is a flat tariff spanning the whole window. A sub-slot partial at either edge
 * is dropped, so slots stay aligned to the half-hour.
 *
 * Slots come back in start order, so the last one is where the series ends.
 */
export function toPriceSlots(
  events: NumericEventLike[],
  since: Date,
  until: Date,
  slotMinutes = SLOT_MINUTES
): PriceSlot[] {
  const slotMs = slotMinutes * 60 * 1000;
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const slots: PriceSlot[] = [];

  for (const event of sorted) {
    const end = event.end ?? (sorted.length === 1
      ? until
      : new Date(event.start.getTime() + slotMs));

    let cursor = Math.max(event.start.getTime(), since.getTime());
    const limit = Math.min(end.getTime(), until.getTime());

    while (cursor + slotMs <= limit) {
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
export function groupIntoBlocks(slots: SlotBlock[], minBlockMinutes: number): SlotBlock[] {
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
 * Whether the unit-rate events reach `until` - the "is the forecast long enough
 * to plan against?" gate. The series is contiguous by construction, so only the
 * far end needs checking: the frontier event (latest start) is the newest
 * published half-hour and stays open until the forecast extends past it. Once it
 * does, the event straddling `until` is closed, with its end on the slot
 * boundary at or after `until`.
 */
export function haveForecastThrough(events: NumericEventLike[], until: Date): boolean {
  if (events.length === 0) {
    return false;
  }

  // A lone open event is a flat tariff - one rate that runs indefinitely.
  if (events.length === 1 && events[0].end === null) {
    return true;
  }

  const frontier = events.reduce((a, b) => (b.start.getTime() > a.start.getTime() ? b : a));

  return frontier.end !== null && frontier.end.getTime() >= until.getTime();
}
