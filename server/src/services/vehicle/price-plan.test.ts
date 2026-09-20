import { PriceSlot } from '../../helpers/prices';
import { planCharge, isDeadlineEngaged, isWithinSlots, PlanOptions } from './price-plan';

const T0 = new Date('2026-01-01T00:00:00Z');

function at(hours: number): Date {
  return new Date(T0.getTime() + hours * 60 * 60 * 1000);
}

// Half-hour slots spanning `[fromHour, toHour)` all at `pence`.
function run(fromHour: number, toHour: number, pence: number): PriceSlot[] {
  const slots: PriceSlot[] = [];

  for (let h = fromHour; h < toHour; h += 0.5) {
    slots.push({ start: at(h), end: at(h + 0.5), pence, isEstimated: false });
  }

  return slots;
}

function totalHours(slots: { start: Date; end: Date }[]): number {
  return slots.reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()) / 3_600_000, 0);
}

function anyOverlap(slots: { start: Date; end: Date }[], fromHour: number, toHour: number): boolean {
  return slots.some(s => s.start.getTime() < at(toHour).getTime() && s.end.getTime() > at(fromHour).getTime());
}

// 10%/h, so `hoursNeeded` is a tenth of the percentage gap - keeps the quota
// arithmetic in the cases below readable.
const RATE = 10;

function plan(overrides: Partial<PlanOptions> = {}) {
  return planCharge({
    slots: [],
    now: at(0),
    chargePercentage: 0,
    baselinePenceFor: () => null,
    schedule: null,
    chargeRatePercentPerHour: RATE,
    defaultLimit: 80,
    plungeLimit: 100,
    deadlineEngageDays: 7,
    startBufferHours: 0,
    ...overrides,
  });
}

describe('planCharge - business as usual', () => {
  it('charges across a cheap day except for an evening spike', () => {
    // Cheap all day (8p) bar a 16:00-19:00 spike (40p); trailing median 20p.
    const slots = [...run(0, 16, 8), ...run(16, 19, 40), ...run(19, 24, 8)];

    const { slots: picked, target } = plan({ slots, baselinePenceFor: () => 20, chargePercentage: 0 });

    expect(totalHours(picked)).toBeCloseTo(8); // 0% -> 80% at 10%/h
    expect(anyOverlap(picked, 16, 19)).toBe(false);
    expect(target).toBe(80);
  });

  it('takes the cheapest below-baseline slots, not the earliest', () => {
    const slots = [...run(0, 12, 8), ...run(12, 16, 5), ...run(16, 24, 8)];

    const { slots: picked } = plan({ slots, baselinePenceFor: () => 20, chargePercentage: 60 });

    expect(totalHours(picked)).toBeCloseTo(2); // 60% -> 80%
    expect(anyOverlap(picked, 0, 12)).toBe(false);
    expect(anyOverlap(picked, 16, 24)).toBe(false);
  });

  it('charges nothing when every slot is above the baseline', () => {
    expect(plan({ slots: run(0, 24, 30), baselinePenceFor: () => 20 }).slots).toEqual([]);
  });

  it('charges nothing once already at the default limit', () => {
    const { slots: picked, target } = plan({ slots: run(0, 24, 5), baselinePenceFor: () => 20, chargePercentage: 80 });

    expect(picked).toEqual([]);
    expect(target).toBe(80);
  });

  it('charges nothing without a baseline to judge cheap against', () => {
    expect(plan({ slots: run(0, 24, 5), baselinePenceFor: () => null }).slots).toEqual([]);
  });

  it('ignores slots already in the past', () => {
    const { slots: picked } = plan({ slots: run(0, 24, 5), now: at(10), baselinePenceFor: () => 20 });

    expect(picked[0].start.getTime()).toBeGreaterThanOrEqual(at(10).getTime());
  });

  it('takes fragmented cheap slots rather than discarding them', () => {
    // The cheapest slots alternate with dearer ones, so none are adjacent.
    const slots: PriceSlot[] = [];

    for (let h = 0; h < 6; h += 0.5) {
      slots.push({ start: at(h), end: at(h + 0.5), pence: h % 1 === 0 ? 5 : 9, isEstimated: false });
    }

    const { slots: picked } = plan({ slots, baselinePenceFor: () => 20, chargePercentage: 70 });

    expect(totalHours(picked)).toBeCloseTo(1);
    expect(picked.every(s => s.start.getTime() % 3_600_000 === 0)).toBe(true);
  });

  it('stops short of the quota once the falling bar drops below the price', () => {
    // A flat 20p bar would take the full 8h quota of these 9p slots. The bar
    // instead starts at 20p and sheds 1p per 1% charged, crossing 9p three
    // slots in (10%/h, so 5% a slot).
    const { slots: picked } = plan({
      slots: run(0, 24, 9), chargePercentage: 0,
      baselinePenceFor: soc => 20 - soc,
    });

    expect(totalHours(picked)).toBeCloseTo(1.5);
  });

  it('takes nothing when the bar is already below the cheapest slot', () => {
    const { slots: picked } = plan({
      slots: run(0, 24, 9), chargePercentage: 60,
      baselinePenceFor: soc => 68 - soc, // 8p at 60%, falling
    });

    expect(picked).toEqual([]);
  });

  it('buys more of the same price when starting emptier', () => {
    const slots = run(0, 24, 9);
    const baselinePenceFor = (soc: number) => 20 - soc / 10;

    const fromEmpty = plan({ slots, chargePercentage: 0, baselinePenceFor });
    const fromHalf = plan({ slots, chargePercentage: 40, baselinePenceFor });

    expect(totalHours(fromEmpty.slots)).toBeGreaterThan(totalHours(fromHalf.slots));
  });
});

describe('planCharge - deadline', () => {
  const cheap = 0;
  const dear = 10_000;
  const schedule = { targetPercentage: 100, targetTime: at(20) };

  it('takes exactly the cheapest slots needed before the deadline, ignoring dearer ones', () => {
    const slots = [...run(0, 10, cheap), ...run(10, 20, dear)];
    const { slots: picked, target, deadline } = plan({
      slots, schedule, chargePercentage: 0,
    });

    expect(totalHours(picked)).toBeCloseTo(10); // 0% -> 100% at 10%/h
    expect(anyOverlap(picked, 10, 20)).toBe(false);
    expect(target).toBe(100);
    expect(deadline).toEqual(at(20));
  });

  it('adds the start buffer to the hours needed before the deadline', () => {
    const slots = run(0, 24, 5);
    const withoutBuffer = plan({ slots, chargePercentage: 90, schedule: { targetPercentage: 100, targetTime: at(20) } });
    const withBuffer = plan({
      slots, chargePercentage: 90, startBufferHours: 1,
      schedule: { targetPercentage: 100, targetTime: at(20) },
    });

    expect(totalHours(withBuffer.slots)).toBeCloseTo(totalHours(withoutBuffer.slots) + 1);
  });

  it('carries isEstimated through when the cheapest picked slot is a forecast one', () => {
    const slots = [
      ...run(0, 5, dear),
      { start: at(5), end: at(5.5), pence: cheap, isEstimated: true },
    ];
    const { slots: picked } = plan({ slots, schedule, chargePercentage: 95 });

    expect(picked).toEqual([{ start: at(5), end: at(5.5), isEstimated: true }]);
  });

  it('takes every slot before the deadline once slack runs out', () => {
    // 8h needed, 6h left: no slack, so price is ignored and everything is taken.
    const slots = [...run(0, 6, 30), ...run(6, 24, 1)];
    const { slots: picked } = plan({
      slots, chargePercentage: 20, schedule: { targetPercentage: 100, targetTime: at(6) },
    });

    expect(totalHours(picked)).toBeCloseTo(6);
    expect(anyOverlap(picked, 6, 24)).toBe(false);
  });

  it('never plans past the deadline', () => {
    const { slots: picked } = plan({
      slots: run(0, 24, 5), chargePercentage: 50,
      schedule: { targetPercentage: 100, targetTime: at(6) },
    });

    expect(picked.every(s => s.end.getTime() <= at(6).getTime())).toBe(true);
  });

  it('falls back to business as usual when the deadline is further off than the engage window', () => {
    const { target, deadline } = plan({
      slots: run(0, 24, 5), baselinePenceFor: () => 20, chargePercentage: 60,
      schedule: { targetPercentage: 100, targetTime: at(24 * 10) }, // 10 days out, past the 7-day engage window
    });

    expect(deadline).toBeNull();
    expect(target).toBe(80);
  });
});

describe('planCharge - plunge', () => {
  it('adds negative slots beyond the default limit and raises the target', () => {
    const slots = [...run(0, 4, 8), ...run(4, 6, -1), ...run(6, 24, 8)];

    const { slots: picked, target } = plan({ slots, baselinePenceFor: () => 20, chargePercentage: 80 });

    // Already at the default limit, so business as usual plans nothing.
    expect(picked).toEqual([
      { start: at(4), end: at(4.5), isEstimated: false }, { start: at(4.5), end: at(5), isEstimated: false },
      { start: at(5), end: at(5.5), isEstimated: false }, { start: at(5.5), end: at(6), isEstimated: false },
    ]);
    expect(target).toBe(100);
  });

  it('leaves the target alone when no slot is negative', () => {
    const { target } = plan({ slots: run(0, 24, 5), baselinePenceFor: () => 20, chargePercentage: 80 });

    expect(target).toBe(80);
  });

  it('applies without a baseline, when business as usual cannot plan', () => {
    const slots = [...run(0, 4, 8), ...run(4, 6, -1)];

    const { slots: picked, target } = plan({ slots, baselinePenceFor: () => null, chargePercentage: 90 });

    expect(totalHours(picked)).toBeCloseTo(1); // 90% -> 100% at 10%/h
    expect(target).toBe(100);
  });

  it('counts slots business as usual already took toward its own quota', () => {
    // Every slot is both below baseline and negative, so the plunge pass should
    // top the plan up to its quota rather than double-count.
    const { slots: picked } = plan({ slots: run(0, 24, -1), baselinePenceFor: () => 20, chargePercentage: 0 });

    expect(totalHours(picked)).toBeCloseTo(10); // 0% -> 100%, not 8 + 10
  });

  it('tops a deadline plan up using negative slots', () => {
    const slots = [...run(0, 12, 5), ...run(12, 24, -1)];
    const { slots: picked, target } = plan({
      slots, chargePercentage: 50, schedule: { targetPercentage: 80, targetTime: at(20) },
    });

    // hoursNeeded is 3h (50% -> 80% at 10%/h); plunge tops up to 100%.
    expect(totalHours(picked)).toBeCloseTo(5);
    expect(target).toBe(100);
  });

  it('ignores negative slots already in the past', () => {
    const slots = [...run(0, 2, -1), ...run(2, 6, 8), ...run(6, 8, -1)];

    const { slots: picked } = plan({ slots, now: at(4), baselinePenceFor: () => null, chargePercentage: 90 });

    expect(picked.every(s => s.start.getTime() >= at(6).getTime())).toBe(true);
  });
});

describe('planCharge - plan end', () => {
  it('ends the plan where the published prices do', () => {
    const { end } = plan({ slots: run(0, 10, 5), baselinePenceFor: () => 20 });

    expect(end).toEqual(at(10));
  });

  it('takes a long publication whole rather than capping it', () => {
    const { end } = plan({ slots: run(0, 36, 5), baselinePenceFor: () => 20 });

    expect(end).toEqual(at(36));
  });

  it('ignores slots that have already passed', () => {
    const { end } = plan({ slots: run(0, 10, 5), baselinePenceFor: () => 20, now: at(4) });

    expect(end).toEqual(at(10));
  });

  it('expires immediately when there are no prices at all', () => {
    const { end, slots: picked } = plan({ slots: [], baselinePenceFor: () => 20 });

    expect(end).toEqual(at(0));
    expect(picked).toEqual([]);
  });

  it('takes everything available up to quota when the plan horizon ends before the deadline', () => {
    // 10h of charge needed by hour 20, but the pool only reaches hour 10 - in
    // production forecast prices always fill this gap out to the engage window,
    // so there's nothing better to defer to.
    const { slots: picked } = plan({
      slots: run(0, 10, 5), chargePercentage: 0,
      schedule: { targetPercentage: 100, targetTime: at(20) },
    });

    expect(totalHours(picked)).toBeCloseTo(10);
  });
});

describe('isDeadlineEngaged', () => {
  const base = {
    now: at(0),
    chargeRatePercentPerHour: RATE,
    deadlineEngageDays: 7,
    startBufferHours: 0,
  };

  it('is true once the deadline is within the engage window', () => {
    expect(isDeadlineEngaged({
      ...base, chargePercentage: 20, schedule: { targetPercentage: 100, targetTime: at(24 * 7) },
    })).toBe(true);
  });

  it('is false while the deadline is further off than the engage window', () => {
    expect(isDeadlineEngaged({
      ...base, chargePercentage: 20, schedule: { targetPercentage: 100, targetTime: at(24 * 7 + 1) },
    })).toBe(false);
  });

  it('is false for a deadline that has already passed', () => {
    expect(isDeadlineEngaged({
      ...base, now: at(10), chargePercentage: 20,
      schedule: { targetPercentage: 100, targetTime: at(5) },
    })).toBe(false);
  });
});

describe('isWithinSlots', () => {
  const slots = [{ start: at(2), end: at(4), isEstimated: false }, { start: at(6), end: at(8), isEstimated: false }];

  it('is true inside a slot', () => {
    expect(isWithinSlots(slots, at(3))).toBe(true);
  });

  it('is false in the gap between slots', () => {
    expect(isWithinSlots(slots, at(5))).toBe(false);
  });

  it('is exclusive of the slot end', () => {
    expect(isWithinSlots(slots, at(4))).toBe(false);
  });
});

describe('planCharge - in-progress slots', () => {
  it('can take the slot `now` falls inside', () => {
    // Plugged in 6 minutes into a cheap slot that a dearer day follows.
    const slots = [...run(0, 0.5, -3), ...run(0.5, 24, 30)];

    const { slots: picked } = plan({
      slots, baselinePenceFor: () => 20, now: at(0.1), chargePercentage: 79,
    });

    expect(picked).toHaveLength(1);
    expect(picked[0].start).toEqual(at(0));
    expect(isWithinSlots(picked, at(0.1))).toBe(true);
  });

  it('still drops a slot that has already ended', () => {
    const slots = run(0, 24, 5);

    const { slots: picked } = plan({
      slots, baselinePenceFor: () => 20, now: at(1), chargePercentage: 79,
    });

    expect(picked.every(s => s.end > at(1))).toBe(true);
  });
});
