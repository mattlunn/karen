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
    slots.push({ start: at(h), end: at(h + 0.5), pence });
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
    horizonEnd: at(24),
    chargePercentage: 0,
    baselinePence: null,
    schedule: null,
    chargeRatePercentPerHour: RATE,
    defaultLimit: 80,
    plungeLimit: 100,
    deadlineEngageFraction: 0.5,
    startBufferHours: 0,
    ...overrides,
  });
}

describe('planCharge - business as usual', () => {
  it('charges across a cheap day except for an evening spike', () => {
    // Cheap all day (8p) bar a 16:00-19:00 spike (40p); trailing median 20p.
    const slots = [...run(0, 16, 8), ...run(16, 19, 40), ...run(19, 24, 8)];

    const { slots: picked, target } = plan({ slots, baselinePence: 20, chargePercentage: 0 });

    expect(totalHours(picked)).toBeCloseTo(8); // 0% -> 80% at 10%/h
    expect(anyOverlap(picked, 16, 19)).toBe(false);
    expect(target).toBe(80);
  });

  it('takes the cheapest below-baseline slots, not the earliest', () => {
    const slots = [...run(0, 12, 8), ...run(12, 16, 5), ...run(16, 24, 8)];

    const { slots: picked } = plan({ slots, baselinePence: 20, chargePercentage: 60 });

    expect(totalHours(picked)).toBeCloseTo(2); // 60% -> 80%
    expect(anyOverlap(picked, 0, 12)).toBe(false);
    expect(anyOverlap(picked, 16, 24)).toBe(false);
  });

  it('charges nothing when every slot is above the baseline', () => {
    expect(plan({ slots: run(0, 24, 30), baselinePence: 20 }).slots).toEqual([]);
  });

  it('charges nothing once already at the default limit', () => {
    const { slots: picked, target } = plan({ slots: run(0, 24, 5), baselinePence: 20, chargePercentage: 80 });

    expect(picked).toEqual([]);
    expect(target).toBe(80);
  });

  it('charges nothing without a baseline to judge cheap against', () => {
    expect(plan({ slots: run(0, 24, 5), baselinePence: null }).slots).toEqual([]);
  });

  it('ignores slots already in the past', () => {
    const { slots: picked } = plan({ slots: run(0, 24, 5), now: at(10), baselinePence: 20 });

    expect(picked[0].start.getTime()).toBeGreaterThanOrEqual(at(10).getTime());
  });

  it('takes fragmented cheap slots rather than discarding them', () => {
    // The cheapest slots alternate with dearer ones, so none are adjacent.
    const slots: PriceSlot[] = [];

    for (let h = 0; h < 6; h += 0.5) {
      slots.push({ start: at(h), end: at(h + 0.5), pence: h % 1 === 0 ? 5 : 9 });
    }

    const { slots: picked } = plan({ slots, baselinePence: 20, chargePercentage: 70 });

    expect(totalHours(picked)).toBeCloseTo(1);
    expect(picked.every(s => s.start.getTime() % 3_600_000 === 0)).toBe(true);
  });
});

describe('planCharge - deadline', () => {
  // 20h to deadline and 10h of charge needed; hours 0-5 and 10-15 are free,
  // 5-10 and 15-20 cost £100. Only the first 10h of prices are published at
  // hour 0, so the charge is planned a horizon at a time.
  const cheap = 0;
  const dear = 10_000;
  const schedule = { targetPercentage: 100, targetTime: at(20) };

  it('places the hour-0 horizon\'s whole share in the free early hours', () => {
    const slots = [...run(0, 5, cheap), ...run(5, 10, dear)];
    const { slots: picked, target, deadline } = plan({
      slots, schedule, horizonEnd: at(10), chargePercentage: 0,
    });

    // share = 10 * (10 / 20) = 5h, entirely within the free 0-5 block.
    expect(totalHours(picked)).toBeCloseTo(5);
    expect(anyOverlap(picked, 5, 10)).toBe(false);
    expect(target).toBe(100);
    expect(deadline).toEqual(at(20));
  });

  it('places the remaining share in the next horizon\'s free hours', () => {
    // Horizon rolls at hour 10; half the charge is still needed, 10-20 published.
    const slots = [...run(10, 15, cheap), ...run(15, 20, dear)];
    const { slots: picked } = plan({
      slots, schedule, now: at(10), horizonEnd: at(20), chargePercentage: 50,
    });

    expect(totalHours(picked)).toBeCloseTo(5);
    expect(anyOverlap(picked, 15, 20)).toBe(false);
  });

  it('never schedules into an expensive window across the whole run', () => {
    const first = plan({
      slots: [...run(0, 5, cheap), ...run(5, 10, dear)], schedule, horizonEnd: at(10),
    });
    const second = plan({
      slots: [...run(10, 15, cheap), ...run(15, 20, dear)],
      schedule, now: at(10), horizonEnd: at(20), chargePercentage: 50,
    });

    const all = [...first.slots, ...second.slots];

    expect(anyOverlap(all, 5, 10)).toBe(false);
    expect(anyOverlap(all, 15, 20)).toBe(false);
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

  it('falls back to business as usual when the deadline is not yet engaged', () => {
    // 2h of charge needed with 48h to go - a ratio well under the 0.5 fraction.
    const { target, deadline } = plan({
      slots: run(0, 24, 5), baselinePence: 20, chargePercentage: 60, schedule,
    });

    expect(deadline).toBeNull();
    expect(target).toBe(80);
  });
});

describe('planCharge - plunge', () => {
  it('adds negative slots beyond the default limit and raises the target', () => {
    const slots = [...run(0, 4, 8), ...run(4, 6, -1), ...run(6, 24, 8)];

    const { slots: picked, target } = plan({ slots, baselinePence: 20, chargePercentage: 80 });

    // Already at the default limit, so business as usual plans nothing.
    expect(picked).toEqual([{ start: at(4), end: at(4.5) }, { start: at(4.5), end: at(5) },
      { start: at(5), end: at(5.5) }, { start: at(5.5), end: at(6) }]);
    expect(target).toBe(100);
  });

  it('leaves the target alone when no slot is negative', () => {
    const { target } = plan({ slots: run(0, 24, 5), baselinePence: 20, chargePercentage: 80 });

    expect(target).toBe(80);
  });

  it('applies without a baseline, when business as usual cannot plan', () => {
    const slots = [...run(0, 4, 8), ...run(4, 6, -1)];

    const { slots: picked, target } = plan({ slots, baselinePence: null, chargePercentage: 90 });

    expect(totalHours(picked)).toBeCloseTo(1); // 90% -> 100% at 10%/h
    expect(target).toBe(100);
  });

  it('counts slots business as usual already took toward its own quota', () => {
    // Every slot is both below baseline and negative, so the plunge pass should
    // top the plan up to its quota rather than double-count.
    const { slots: picked } = plan({ slots: run(0, 24, -1), baselinePence: 20, chargePercentage: 0 });

    expect(totalHours(picked)).toBeCloseTo(10); // 0% -> 100%, not 8 + 10
  });

  it('tops a deadline plan up using negative slots', () => {
    const slots = [...run(0, 12, 5), ...run(12, 24, -1)];
    const { slots: picked, target } = plan({
      slots, chargePercentage: 50, schedule: { targetPercentage: 80, targetTime: at(20) },
    });

    // Deadline share is 3h * (24/20 capped at 1) = 3h; plunge tops up to 100%.
    expect(totalHours(picked)).toBeCloseTo(5);
    expect(target).toBe(100);
  });

  it('ignores negative slots already in the past', () => {
    const slots = [...run(0, 2, -1), ...run(2, 6, 8), ...run(6, 8, -1)];

    const { slots: picked } = plan({ slots, now: at(4), baselinePence: null, chargePercentage: 90 });

    expect(picked.every(s => s.start.getTime() >= at(6).getTime())).toBe(true);
  });
});

describe('planCharge - planning horizon', () => {
  it('ends the plan where the published prices do', () => {
    // Cable goes in with only 10h of the 24h horizon published.
    const { horizonEnd } = plan({ slots: run(0, 10, 5), baselinePence: 20, horizonEnd: at(24) });

    expect(horizonEnd).toEqual(at(10));
  });

  it('keeps the requested horizon when prices reach past it', () => {
    const { horizonEnd } = plan({ slots: run(0, 36, 5), baselinePence: 20, horizonEnd: at(24) });

    expect(horizonEnd).toEqual(at(24));
  });

  it('expires immediately when there are no prices at all', () => {
    const { horizonEnd, slots: picked } = plan({ slots: [], baselinePence: 20 });

    expect(horizonEnd).toEqual(at(0));
    expect(picked).toEqual([]);
  });

  it('pro-rates a deadline share over the published window, not the requested one', () => {
    // 10h of charge needed by hour 20, but prices only reach hour 10.
    const { slots: picked } = plan({
      slots: run(0, 10, 5), horizonEnd: at(24), chargePercentage: 0,
      schedule: { targetPercentage: 100, targetTime: at(20) },
    });

    // share = 10 * (10 / 20) = 5h. Pro-rating over the requested 24h horizon
    // would saturate instead and take the whole published window.
    expect(totalHours(picked)).toBeCloseTo(5);
  });
});

describe('isDeadlineEngaged', () => {
  const base = {
    now: at(0),
    chargeRatePercentPerHour: RATE,
    deadlineEngageFraction: 0.5,
    startBufferHours: 0,
  };

  it('is true once charging would fill the engage fraction of the time left', () => {
    // 8h needed, 16h left - exactly 0.5.
    expect(isDeadlineEngaged({
      ...base, chargePercentage: 20, schedule: { targetPercentage: 100, targetTime: at(16) },
    })).toBe(true);
  });

  it('is false while the deadline is further off', () => {
    expect(isDeadlineEngaged({
      ...base, chargePercentage: 20, schedule: { targetPercentage: 100, targetTime: at(48) },
    })).toBe(false);
  });

  it('counts the start buffer toward the time needed', () => {
    expect(isDeadlineEngaged({
      ...base, startBufferHours: 2, chargePercentage: 40,
      schedule: { targetPercentage: 100, targetTime: at(16) },
    })).toBe(true);
  });

  it('is false for a deadline that has already passed', () => {
    expect(isDeadlineEngaged({
      ...base, now: at(10), chargePercentage: 20,
      schedule: { targetPercentage: 100, targetTime: at(5) },
    })).toBe(false);
  });
});

describe('isWithinSlots', () => {
  const slots = [{ start: at(2), end: at(4) }, { start: at(6), end: at(8) }];

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
