import { PriceSlot } from '../../helpers/prices';
import { ChargeType } from '../../models/capabilities';
import { planCharge, isDeadlineEngaged, deadlineEngagesAt, findActiveSlot, PlanOptions, PlanSlot } from './price-plan';

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

function planned(fromHour: number, type: ChargeType, targetPercentage: number, isEstimated = false): PlanSlot {
  return { start: at(fromHour), end: at(fromHour + 0.5), isEstimated, type, targetPercentage };
}

function hoursOf(slots: PlanSlot[], type: ChargeType): number {
  return totalHours(slots.filter(s => s.type === type));
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
  // Cosy-shaped: cheap 04-07, 13-16 and 22-24, a 16-19 peak, the day rate otherwise.
  const cosyDay = [
    ...run(0, 4, 29), ...run(4, 7, 14), ...run(7, 13, 29), ...run(13, 16, 14),
    ...run(16, 19, 43), ...run(19, 22, 29), ...run(22, 24, 14),
  ];

  it('charges only in the cheapest published slots, earliest first', () => {
    const { slots: picked } = plan({ slots: cosyDay, chargePercentage: 20 });

    expect(totalHours(picked)).toBeCloseTo(6); // 20% -> 80% at 10%/h
    expect(anyOverlap(picked, 4, 7)).toBe(true);
    expect(anyOverlap(picked, 13, 16)).toBe(true);
    expect(anyOverlap(picked, 22, 24)).toBe(false);
    expect(anyOverlap(picked, 0, 4) || anyOverlap(picked, 7, 13) || anyOverlap(picked, 16, 22)).toBe(false);
    expect(picked.every(s => s.type === 'BAU' && s.targetPercentage === 80)).toBe(true);
  });

  it('stops short of the limit rather than pay more than the cheapest price', () => {
    const { slots: picked } = plan({ slots: [...run(0, 2, 10), ...run(2, 24, 20)], chargePercentage: 0 });

    expect(totalHours(picked)).toBeCloseTo(2);
    expect(anyOverlap(picked, 2, 24)).toBe(false);
  });

  it('judges the cheapest price among published slots only, ignoring cheaper forecast ones', () => {
    const slots = [
      ...run(0, 4, 30),
      ...run(4, 24, 5).map(s => ({ ...s, isEstimated: true })),
    ];

    const { slots: picked } = plan({ slots, chargePercentage: 0 });

    expect(totalHours(picked)).toBeCloseTo(4);
    expect(picked.every(s => !s.isEstimated)).toBe(true);
  });

  it('charges nothing once already at the default limit', () => {
    const { slots: picked } = plan({ slots: cosyDay, chargePercentage: 80 });

    expect(picked).toEqual([]);
  });

  it('ignores slots already in the past', () => {
    const { slots: picked } = plan({ slots: cosyDay, now: at(10), chargePercentage: 70 });

    expect(picked).toEqual([planned(13, 'BAU', 80), planned(13.5, 'BAU', 80)]);
  });

  it('takes fragmented cheap slots rather than discarding them', () => {
    // The cheapest slots alternate with dearer ones, so none are adjacent.
    const slots: PriceSlot[] = [];

    for (let h = 0; h < 6; h += 0.5) {
      slots.push({ start: at(h), end: at(h + 0.5), pence: h % 1 === 0 ? 5 : 9, isEstimated: false });
    }

    const { slots: picked } = plan({ slots, chargePercentage: 70 });

    expect(totalHours(picked)).toBeCloseTo(1);
    expect(picked.every(s => s.start.getTime() % 3_600_000 === 0)).toBe(true);
  });
});

describe('planCharge - deadline', () => {
  const cheap = 0;
  const dear = 10_000;
  const schedule = { targetPercentage: 100, targetTime: at(20) };

  it('takes exactly the cheapest slots needed before the deadline, ignoring dearer ones', () => {
    const slots = [...run(0, 10, cheap), ...run(10, 20, dear)];
    const { slots: picked, deadline } = plan({
      slots, schedule, chargePercentage: 0,
    });

    expect(totalHours(picked)).toBeCloseTo(10); // 0% -> 100% at 10%/h
    expect(anyOverlap(picked, 10, 20)).toBe(false);
    expect(deadline).toEqual(at(20));
  });

  it('charges to the default limit as business as usual, then tops up toward the deadline', () => {
    const slots = [...run(0, 10, cheap), ...run(10, 20, dear)];
    const { slots: picked } = plan({ slots, schedule, chargePercentage: 0 });

    expect(hoursOf(picked, 'BAU')).toBeCloseTo(8); // 0% -> 80%
    expect(hoursOf(picked, 'DEADLINE')).toBeCloseTo(2); // 80% -> 100%
    expect(picked.filter(s => s.type === 'BAU').every(s => s.targetPercentage === 80)).toBe(true);
    expect(picked.filter(s => s.type === 'DEADLINE').every(s => s.targetPercentage === 100)).toBe(true);
  });

  it('books business as usual now and leaves the top-up as late as equal prices allow', () => {
    // Cosy-shaped days, with only the first one published.
    const cosyDay = (day: number, isEstimated: boolean) => [
      ...run(day + 0, day + 4, 29), ...run(day + 4, day + 7, 14), ...run(day + 7, day + 13, 29),
      ...run(day + 13, day + 16, 14), ...run(day + 16, day + 19, 43), ...run(day + 19, day + 22, 29),
      ...run(day + 22, day + 24, 14),
    ].map(s => ({ ...s, isEstimated }));
    const slots = [...cosyDay(0, false), ...cosyDay(24, true), ...cosyDay(48, true)];
    const { slots: picked } = plan({
      slots, chargePercentage: 50, schedule: { targetPercentage: 100, targetTime: at(72) },
    });
    const bau = picked.filter(s => s.type === 'BAU');
    const topUp = picked.filter(s => s.type === 'DEADLINE');

    expect(totalHours(bau)).toBeCloseTo(3); // 50% -> 80%, from the first cheap window
    expect(anyOverlap(bau, 4, 7)).toBe(true);
    expect(totalHours(topUp)).toBeCloseTo(2); // 80% -> 100%, in the last one
    expect(anyOverlap(topUp, 70, 72)).toBe(true);
  });

  it('leaves out business-as-usual slots past the deadline', () => {
    const slots = [...run(0, 6, 30), ...run(6, 24, 1)];
    const { slots: picked } = plan({
      slots, chargePercentage: 50, schedule: { targetPercentage: 60, targetTime: at(6) },
    });

    expect(picked.every(s => s.end.getTime() <= at(6).getTime())).toBe(true);
    expect(picked.every(s => s.type === 'DEADLINE')).toBe(true);
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

  it('takes nothing, buffer included, once already at the target', () => {
    const { slots: picked, deadline } = plan({
      slots: run(0, 24, 5), chargePercentage: 100, startBufferHours: 12, schedule,
    });

    expect(picked).toEqual([]);
    expect(deadline).toEqual(at(20));
  });

  it('carries isEstimated through when the cheapest picked slot is a forecast one', () => {
    const slots = [
      ...run(0, 5, dear),
      { start: at(5), end: at(5.5), pence: cheap, isEstimated: true },
    ];
    const { slots: picked } = plan({ slots, schedule, chargePercentage: 95 });

    expect(picked).toEqual([planned(5, 'DEADLINE', 100, true)]);
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

  it('takes the latest of equally cheap slots before the deadline', () => {
    const { slots: picked } = plan({ slots: run(0, 20, 5), schedule, chargePercentage: 90 });

    expect(picked).toEqual([planned(19, 'DEADLINE', 100), planned(19.5, 'DEADLINE', 100)]);
  });

  it('buys the hours it must take at a dearer rate as close to the deadline as it can', () => {
    // 6h needed plus a 4h buffer, but only 8h at the cheap rate before the deadline.
    const slots = [...run(0, 4, 14), ...run(4, 12, 29), ...run(12, 16, 14), ...run(16, 20, 29)];
    const { slots: picked } = plan({ slots, schedule, chargePercentage: 40, startBufferHours: 4 });

    expect(totalHours(picked)).toBeCloseTo(10);
    expect(anyOverlap(picked, 4, 12) || anyOverlap(picked, 16, 18)).toBe(false);
    expect(anyOverlap(picked, 18, 20)).toBe(true);
  });

  it('falls back to business as usual when the deadline is further off than the engage window', () => {
    const { slots: picked, deadline } = plan({
      slots: run(0, 24, 5), chargePercentage: 60,
      schedule: { targetPercentage: 100, targetTime: at(24 * 10) }, // 10 days out, past the 7-day engage window
    });

    expect(deadline).toBeNull();
    expect(totalHours(picked)).toBeCloseTo(2); // 60% -> 80%
    expect(picked.every(s => s.type === 'BAU')).toBe(true);
  });
});

describe('planCharge - plunge', () => {
  it('adds negative slots beyond the default limit, charging them to the plunge limit', () => {
    const slots = [...run(0, 4, 8), ...run(4, 6, -1), ...run(6, 24, 8)];

    const { slots: picked } = plan({ slots, chargePercentage: 80 });

    // Already at the default limit, so business as usual plans nothing.
    expect(picked).toEqual([
      planned(4, 'PLUNGE', 100), planned(4.5, 'PLUNGE', 100), planned(5, 'PLUNGE', 100), planned(5.5, 'PLUNGE', 100),
    ]);
  });

  it('books nothing past the default limit when no slot is negative', () => {
    const { slots: picked } = plan({ slots: run(0, 24, 5), chargePercentage: 80 });

    expect(picked).toEqual([]);
  });

  it('applies once business as usual has nothing left to do', () => {
    const slots = [...run(0, 4, 8), ...run(4, 6, -1)];

    const { slots: picked } = plan({ slots, chargePercentage: 90 });

    expect(totalHours(picked)).toBeCloseTo(1); // 90% -> 100% at 10%/h
    expect(picked.every(s => s.type === 'PLUNGE')).toBe(true);
  });

  it('counts slots business as usual already took toward its own quota', () => {
    // Every slot is both the cheapest and negative, so the plunge pass should
    // top the plan up to its quota rather than double-count.
    const { slots: picked } = plan({ slots: run(0, 24, -1), chargePercentage: 0 });

    expect(totalHours(picked)).toBeCloseTo(10); // 0% -> 100%, not 8 + 10
  });

  it('tops a deadline plan up using negative slots', () => {
    const slots = [...run(0, 12, 5), ...run(12, 24, -1)];
    const { slots: picked } = plan({
      slots, chargePercentage: 50, schedule: { targetPercentage: 80, targetTime: at(20) },
    });

    // hoursNeeded is 3h (50% -> 80% at 10%/h); plunge tops up to 100%.
    expect(totalHours(picked)).toBeCloseTo(5);
    expect(hoursOf(picked, 'PLUNGE')).toBeCloseTo(2);
  });

  it('ignores negative slots already in the past', () => {
    const slots = [...run(0, 2, -1), ...run(2, 6, 8), ...run(6, 8, -1)];

    const { slots: picked } = plan({ slots, now: at(4), chargePercentage: 90 });

    expect(picked.every(s => s.start.getTime() >= at(6).getTime())).toBe(true);
  });
});

describe('planCharge - plan end', () => {
  it('ends the plan where the published prices do', () => {
    const { end } = plan({ slots: run(0, 10, 5) });

    expect(end).toEqual(at(10));
  });

  it('takes a long publication whole rather than capping it', () => {
    const { end } = plan({ slots: run(0, 36, 5) });

    expect(end).toEqual(at(36));
  });

  it('ignores slots that have already passed', () => {
    const { end } = plan({ slots: run(0, 10, 5), now: at(4) });

    expect(end).toEqual(at(10));
  });

  it('marks where published prices give way to forecast ones', () => {
    const slots = [...run(0, 10, 5), ...run(10, 20, 5).map(s => ({ ...s, isEstimated: true }))];
    const { end, publishedEnd } = plan({ slots });

    expect(end).toEqual(at(20));
    expect(publishedEnd).toEqual(at(10));
  });

  it('expires immediately when there are no prices at all', () => {
    const { end, slots: picked } = plan({ slots: [] });

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

  it('engages exactly at the time deadlineEngagesAt reports', () => {
    const options = {
      ...base, chargePercentage: 20, schedule: { targetPercentage: 100, targetTime: at(40) },
    };
    const engagesAt = deadlineEngagesAt(options);

    expect(isDeadlineEngaged({ ...options, now: new Date(engagesAt.getTime() - 1) })).toBe(false);
    expect(isDeadlineEngaged({ ...options, now: engagesAt })).toBe(true);
  });
});

describe('deadlineEngagesAt', () => {
  it('is deadlineEngageDays before the deadline', () => {
    expect(deadlineEngagesAt({
      deadlineEngageDays: 7, schedule: { targetPercentage: 100, targetTime: at(24 * 10) },
    })).toEqual(at(24 * 3));
  });
});

describe('findActiveSlot', () => {
  const slots = [planned(2, 'BAU', 80), planned(6, 'DEADLINE', 100)];

  it('finds the slot `now` falls inside', () => {
    expect(findActiveSlot(slots, at(6.25))).toBe(slots[1]);
  });

  it('finds nothing in the gap between slots', () => {
    expect(findActiveSlot(slots, at(5))).toBeUndefined();
  });

  it('is exclusive of the slot end', () => {
    expect(findActiveSlot(slots, at(2.5))).toBeUndefined();
  });
});

describe('planCharge - in-progress slots', () => {
  it('can take the slot `now` falls inside', () => {
    // Plugged in 6 minutes into a cheap slot that a dearer day follows.
    const slots = [...run(0, 0.5, -3), ...run(0.5, 24, 30)];

    const { slots: picked } = plan({
      slots, now: at(0.1), chargePercentage: 79,
    });

    expect(picked).toHaveLength(1);
    expect(picked[0].start).toEqual(at(0));
    expect(findActiveSlot(picked, at(0.1))).toBeDefined();
  });

  it('still drops a slot that has already ended', () => {
    const slots = run(0, 24, 5);

    const { slots: picked } = plan({
      slots, now: at(1), chargePercentage: 79,
    });

    expect(picked.every(s => s.end > at(1))).toBe(true);
  });
});
