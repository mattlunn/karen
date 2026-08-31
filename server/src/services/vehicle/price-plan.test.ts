import { PriceSlot } from '../../helpers/prices';
import { planDeadlineCharge, planOpportunisticCharge, isWithinBlocks } from './price-plan';

const T0 = new Date('2026-01-01T00:00:00Z');

function at(hours: number): Date {
  return new Date(T0.getTime() + hours * 60 * 60 * 1000);
}

// Half-hour slots spanning `[fromHour, toHour)` all at `pence`.
function run(fromHour: number, toHour: number, pence: number): PriceSlot[] {
  const slots: PriceSlot[] = [];

  for (let h = fromHour; h < toHour; h += 0.5) {
    slots.push({ start: at(h), end: at(h + 0.5), pence });
  }

  return slots;
}

function totalHours(blocks: { start: Date; end: Date }[]): number {
  return blocks.reduce((sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 3_600_000, 0);
}

function anyOverlap(blocks: { start: Date; end: Date }[], fromHour: number, toHour: number): boolean {
  return blocks.some(b => b.start.getTime() < at(toHour).getTime() && b.end.getTime() > at(fromHour).getTime());
}

describe('planDeadlineCharge - Matt\'s counterexample', () => {
  // 48h to deadline; hours 0-12 and 24-36 are free, 12-24 and 36-48 cost £100.
  // Only the first 24h of prices are published at hour 0.
  const cheap = 0;
  const dear = 10_000;

  it('places the hour-0 window\'s whole share in the free early hours', () => {
    const published = [...run(0, 12, cheap), ...run(12, 24, dear)];
    // 24h of charge needed over 48h to deadline.
    const plan = planDeadlineCharge(published, 24, at(0), at(48), 60);

    expect(plan.windowEnd).toEqual(at(24));
    // share = 24 * (24 / 48) = 12h, entirely within the free 0-12 block.
    expect(totalHours(plan.blocks)).toBeCloseTo(12);
    expect(anyOverlap(plan.blocks, 12, 24)).toBe(false);
  });

  it('places the remaining share in the next window\'s free hours', () => {
    // Window rolls at hour 24; 12h still needed, now 24-48 is published.
    const published = [...run(24, 36, cheap), ...run(36, 48, dear)];
    const plan = planDeadlineCharge(published, 12, at(24), at(48), 60);

    expect(plan.windowEnd).toEqual(at(48));
    expect(totalHours(plan.blocks)).toBeCloseTo(12);
    expect(anyOverlap(plan.blocks, 36, 48)).toBe(false);
  });

  it('never schedules into an expensive window across the whole run', () => {
    const w1 = planDeadlineCharge([...run(0, 12, cheap), ...run(12, 24, dear)], 24, at(0), at(48), 60);
    const w2 = planDeadlineCharge([...run(24, 36, cheap), ...run(36, 48, dear)], 12, at(24), at(48), 60);

    expect(anyOverlap([...w1.blocks, ...w2.blocks], 12, 24)).toBe(false);
    expect(anyOverlap([...w1.blocks, ...w2.blocks], 36, 48)).toBe(false);
  });
});

describe('planDeadlineCharge - mechanics', () => {
  it('falls back to a continuous block once slack runs out', () => {
    const slots = run(0, 24, 5);
    // 20.5h needed but only 20h to the deadline: no slack, charge continuously.
    const plan = planDeadlineCharge(slots, 20.5, at(0), at(20), 60);

    expect(plan.blocks).toEqual([{ start: at(0), end: at(20) }]);
    expect(plan.windowEnd).toEqual(at(20));
  });

  it('carries the shortfall forward when a window cannot absorb its share', () => {
    // Only 3h of cheap slots in the window, but the pro-rata share is larger;
    // selectCheapestSlots caps at what exists, so the block is only ~3h and
    // the rest is left for the next window (re-derived from live SoC).
    const published = [...run(0, 3, 1), ...run(3, 12, 9)];
    const plan = planDeadlineCharge(published, 24, at(0), at(48), 60);

    // windowEnd is the published horizon (12h), share = 24 * (12/48) = 6h,
    // but only slots exist to 12h so it picks the 6 cheapest of what's there.
    expect(plan.windowEnd).toEqual(at(12));
    expect(totalHours(plan.blocks)).toBeLessThanOrEqual(6.01);
    expect(totalHours(plan.blocks)).toBeGreaterThan(0);
  });

  it('returns no blocks when nothing is needed', () => {
    expect(planDeadlineCharge(run(0, 24, 5), 0, at(0), at(24), 60).blocks).toEqual([]);
  });
});

describe('planOpportunisticCharge', () => {
  it('charges across a cheap day except for an evening spike', () => {
    // Cheap all day (8p) bar a 16:00-19:00 spike (40p); trailing median 20p.
    const slots = [...run(0, 16, 8), ...run(16, 19, 40), ...run(19, 24, 8)];

    const blocks = planOpportunisticCharge(slots, at(0), 20, 60, 24);

    expect(totalHours(blocks)).toBeCloseTo(21); // everything but the 3h spike
    expect(anyOverlap(blocks, 16, 19)).toBe(false);
  });

  it('charges nothing when every slot is above the baseline', () => {
    expect(planOpportunisticCharge(run(0, 24, 30), at(0), 20, 60, 24)).toEqual([]);
  });

  it('ignores slots already in the past', () => {
    const blocks = planOpportunisticCharge(run(0, 24, 5), at(10), 20, 60, 24);

    expect(blocks[0].start.getTime()).toBeGreaterThanOrEqual(at(10).getTime());
  });

  it('takes the cheapest below-baseline slots, not the earliest', () => {
    // Both runs are below the 20p baseline, but only 2h of charge is needed.
    const slots = [...run(0, 12, 8), ...run(12, 16, 5), ...run(16, 24, 8)];

    const blocks = planOpportunisticCharge(slots, at(0), 20, 60, 2);

    expect(totalHours(blocks)).toBeCloseTo(2);
    expect(anyOverlap(blocks, 0, 12)).toBe(false);
    expect(anyOverlap(blocks, 16, 24)).toBe(false);
  });

  it('keeps the slot already in progress eligible', () => {
    const slots = [...run(0, 10, 20), ...run(10, 10.5, 5), ...run(10.5, 24, 8)];

    const blocks = planOpportunisticCharge(slots, at(10.2), 15, 30, 0.5);

    expect(blocks[0].start).toEqual(at(10));
  });

  it('charges nothing when no charge is needed', () => {
    expect(planOpportunisticCharge(run(0, 24, 5), at(0), 20, 60, 0)).toEqual([]);
  });
});

describe('isWithinBlocks', () => {
  const blocks = [{ start: at(2), end: at(4) }, { start: at(6), end: at(8) }];

  it('is true inside a block', () => {
    expect(isWithinBlocks(blocks, at(3))).toBe(true);
  });

  it('is false in the gap between blocks', () => {
    expect(isWithinBlocks(blocks, at(5))).toBe(false);
  });

  it('is exclusive of the block end', () => {
    expect(isWithinBlocks(blocks, at(4))).toBe(false);
  });
});
