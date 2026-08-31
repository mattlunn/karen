import {
  toPriceSlots,
  findCheapestWindow,
  selectCheapestSlots,
  medianPence,
  groupIntoBlocks,
  coversWholeWindow,
  PriceSlot,
} from './prices';

const T0 = new Date('2026-01-01T00:00:00Z');

function at(minutes: number): Date {
  return new Date(T0.getTime() + minutes * 60_000);
}

// Build a contiguous run of half-hour slots starting at `startMin` from a list
// of per-slot pences.
function slots(startMin: number, pences: number[]): PriceSlot[] {
  return pences.map((pence, i) => ({
    start: at(startMin + i * 30),
    end: at(startMin + (i + 1) * 30),
    pence,
  }));
}

describe('toPriceSlots', () => {
  it('re-expands a collapsed multi-half-hour event into individual slots', () => {
    const events = [
      { start: at(0), end: at(120), value: 10 }, // one event spanning 4 slots
      { start: at(120), end: null, value: 20 },
    ];

    const result = toPriceSlots(events, at(0), at(150));

    expect(result).toHaveLength(5);
    expect(result.slice(0, 4).every(s => s.pence === 10)).toBe(true);
    expect(result[4]).toMatchObject({ pence: 20 });
    expect(result[0].start).toEqual(at(0));
    expect(result[4].end).toEqual(at(150));
  });

  it('drops a trailing open event beyond the published horizon rather than fabricating prices', () => {
    const events = [
      { start: at(0), end: at(30), value: 10 },
      { start: at(30), end: at(60), value: 11 },
      { start: at(60), end: null, value: 12 }, // last fetched half-hour, still open
    ];

    // Window asks for 4 hours but only 90 minutes are published.
    const result = toPriceSlots(events, at(0), at(240));

    expect(result).toHaveLength(3);
    expect(result.at(-1)!.end).toEqual(at(90));
  });

  it('treats a lone open event as a flat tariff covering the whole window', () => {
    const events = [{ start: at(-1000), end: null, value: 25 }];

    const result = toPriceSlots(events, at(0), at(180));

    expect(result).toHaveLength(6);
    expect(result.every(s => s.pence === 25)).toBe(true);
    expect(result[0].start).toEqual(at(0));
    expect(result.at(-1)!.end).toEqual(at(180));
  });
});

describe('findCheapestWindow', () => {
  it('finds the cheapest contiguous window of the required duration', () => {
    const s = slots(0, [10, 10, 3, 3, 10, 10]);

    const win = findCheapestWindow(s, 60, at(0), at(180));

    expect(win).not.toBeNull();
    expect(win!.start).toEqual(at(60));
    expect(win!.end).toEqual(at(120));
    expect(win!.averagePence).toBeCloseTo(3);
  });

  it('breaks ties on the earliest start', () => {
    const s = slots(0, [5, 5, 8, 5, 5]);

    const win = findCheapestWindow(s, 60, at(0), at(150));

    expect(win!.start).toEqual(at(0));
  });

  it('only slides over contiguous runs', () => {
    // A gap between 30 and 90: two runs of one slot each, neither long enough
    // for a 60-minute window, even though four cheap slots exist overall.
    const s = [...slots(0, [1]), ...slots(90, [1, 1, 1])];

    const win = findCheapestWindow(s, 90, at(0), at(240));

    expect(win!.start).toEqual(at(90));
    expect(win!.end).toEqual(at(180));
  });

  it('returns null when no contiguous run is long enough', () => {
    const s = [...slots(0, [1]), ...slots(90, [1])];

    expect(findCheapestWindow(s, 90, at(0), at(240))).toBeNull();
  });

  it('respects notBefore / notAfter bounds', () => {
    const s = slots(0, [1, 1, 9, 9]);

    const win = findCheapestWindow(s, 30, at(60), at(240));

    expect(win!.start).toEqual(at(60));
    expect(win!.averagePence).toBeCloseTo(9);
  });
});

describe('selectCheapestSlots', () => {
  it('returns the N cheapest slots in chronological order', () => {
    const s = slots(0, [8, 2, 5, 1, 9]);

    const picked = selectCheapestSlots(s, 3, at(0), at(240));

    // Cheapest three are pences 2, 5, 1 - returned in chronological order.
    expect(picked.map(p => p.pence)).toEqual([2, 5, 1]);
    expect(picked.map(p => p.start.getTime())).toEqual([at(30), at(60), at(90)].map(d => d.getTime()));
  });

  it('breaks ties on earliest start', () => {
    const s = slots(0, [3, 3, 3, 1]);

    const picked = selectCheapestSlots(s, 2, at(0), at(240));

    expect(picked.map(p => p.start.getTime())).toEqual([at(0).getTime(), at(90).getTime()]);
  });
});

describe('medianPence', () => {
  it('returns null for no slots', () => {
    expect(medianPence([])).toBeNull();
  });

  it('averages the two middle values for an even count', () => {
    expect(medianPence(slots(0, [10, 20, 30, 40]))).toBe(25);
  });

  it('returns the middle value for an odd count', () => {
    expect(medianPence(slots(0, [5, 1, 9]))).toBe(5);
  });
});

describe('groupIntoBlocks', () => {
  it('merges adjacent slots into one block', () => {
    const blocks = groupIntoBlocks(slots(0, [1, 1, 1]), 30);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ start: at(0), end: at(90) });
  });

  it('splits non-adjacent slots into separate blocks', () => {
    const s = [...slots(0, [1, 1]), ...slots(120, [1, 1])];

    const blocks = groupIntoBlocks(s, 30);

    expect(blocks).toEqual([
      { start: at(0), end: at(60) },
      { start: at(120), end: at(180) },
    ]);
  });

  it('discards blocks shorter than minBlockMinutes', () => {
    const s = [...slots(0, [1]), ...slots(120, [1, 1, 1])];

    const blocks = groupIntoBlocks(s, 60);

    expect(blocks).toEqual([{ start: at(120), end: at(210) }]);
  });
});

describe('coversWholeWindow', () => {
  it('is true when slots contiguously span the window', () => {
    expect(coversWholeWindow(slots(0, [1, 1, 1, 1]), at(0), at(120))).toBe(true);
  });

  it('is false when the tail is missing', () => {
    expect(coversWholeWindow(slots(0, [1, 1]), at(0), at(240))).toBe(false);
  });

  it('is false when there is an internal gap before the window end', () => {
    const s = [...slots(0, [1, 1]), ...slots(120, [1, 1])];

    expect(coversWholeWindow(s, at(0), at(180))).toBe(false);
  });

  it('tolerates a sub-slot partial at the near edge', () => {
    // First slot starts 10 minutes after `since`.
    expect(coversWholeWindow(slots(10, [1, 1, 1, 1]), at(0), at(130))).toBe(true);
  });

  it('is false for no slots', () => {
    expect(coversWholeWindow([], at(0), at(120))).toBe(false);
  });
});
