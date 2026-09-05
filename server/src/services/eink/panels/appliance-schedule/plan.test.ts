import { PriceSlot } from '../../../../helpers/prices';
import { planAppliance, composeProfiles, ApplianceProfile, PlanApplianceOptions } from './plan';

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

const oneSlotProfile: ApplianceProfile = {
  id: 'test', label: 'Test', cycleMinutes: 30, powerProfileKwh: [1], delayMinHours: 3, delayMaxHours: 12,
};

function plan(slots: PriceSlot[], overrides: Partial<PlanApplianceOptions> = {}) {
  return planAppliance({
    slots, now: at(0), profile: oneSlotProfile, ...overrides,
  });
}

describe('planAppliance - cost now', () => {
  it('weights each slot in the cycle by its own power-profile entry', () => {
    const profile: ApplianceProfile = { id: 't', label: 'T', cycleMinutes: 60, powerProfileKwh: [2, 1], delayMinHours: 3, delayMaxHours: 12 };
    const slots = [{ start: at(0), end: at(0.5), pence: 5 }, { start: at(0.5), end: at(1), pence: 3 }];

    expect(plan(slots, { profile })!.costNowPence).toBe(2 * 5 + 1 * 3);
  });

  it('returns null when the cycle cannot even be costed starting immediately', () => {
    const profile: ApplianceProfile = {
      id: 'washer', label: 'Washer', cycleMinutes: 130, powerProfileKwh: [0.45, 0.2, 0.1, 0.1, 0.05], delayMinHours: 3, delayMaxHours: 12,
    };

    expect(plan(run(0, 1, 10), { profile })).toBeNull();
  });
});

describe('planAppliance - buckets', () => {
  it('splits [delayMinHours, delayMaxHours] into 3 equal, chronological buckets', () => {
    const { buckets } = plan(run(0, 24, 10))!;

    expect(buckets.map(b => [b.from, b.to])).toEqual([[3, 6], [6, 9], [9, 12]]);
  });

  it('picks the cheapest whole hour within each bucket, not the cheapest overall', () => {
    // Prices fall monotonically from hour 3 to hour 12 - the naive "4
    // cheapest overall" would cluster at 9/10/11/12; bucketing should spread
    // one pick across each third of the window instead.
    const slots = run(0, 24, 10).map(s => ({ ...s, pence: 12 - (s.start.getTime() - at(3).getTime()) / 3_600_000 }));
    const { buckets } = plan(slots)!;

    expect(buckets.map(b => b.option?.hours)).toEqual([5, 8, 12]);
  });

  it('renders a bucket as empty (not a guess) when nothing in its range is feasible', () => {
    // Forecast only reaches hour 7 - the last bucket (9-12h) has nothing to cost.
    const { buckets } = plan(run(0, 7, 10))!;

    expect(buckets[2].option).toBeNull();
    expect(buckets[0].option).not.toBeNull();
  });

  it('sets best to the cheapest option across all buckets', () => {
    const cheapStarts = new Set([4.5, 7.5].map(h => at(h).getTime()));
    const slots = run(0, 24, 10).map(s => (cheapStarts.has(s.start.getTime()) ? { ...s, pence: 1 } : s));
    const { best } = plan(slots)!;

    expect(best).toEqual({ hours: 5, costPence: 1, savingPercent: 90 });
  });

  it('sets best to null when every bucket is empty', () => {
    const profile: ApplianceProfile = { ...oneSlotProfile, delayMinHours: 20, delayMaxHours: 24 };

    // costNowPence is costable (hour 0 is in range), but nothing at 20-24h is.
    expect(plan(run(0, 10, 5), { profile })!.best).toBeNull();
  });

  it('computes each option\'s saving relative to running immediately', () => {
    // A 3h delay (the earliest allowed) starts at 2.5h (3h minus the 30-minute cycle).
    const slots = [...run(0, 2.5, 20), ...run(2.5, 3, 5), ...run(3, 24, 20)];
    const { buckets } = plan(slots)!;
    const threeHour = buckets[0].option!;

    expect(threeHour.hours).toBe(3);
    expect(threeHour.costPence).toBe(5);
    expect(threeHour.savingPercent).toBe(75); // (20 - 5) / 20 * 100
  });
});

describe('composeProfiles', () => {
  const washer: ApplianceProfile = {
    id: 'washing_machine', label: 'Washing machine', cycleMinutes: 130, powerProfileKwh: [0.45, 0.2, 0.1, 0.1, 0.05], delayMinHours: 3, delayMaxHours: 12,
  };
  const dryer: ApplianceProfile = {
    id: 'tumble_dryer', label: 'Tumble dryer', cycleMinutes: 280, powerProfileKwh: [0.55, 0.5, 0.5, 0.45, 0.4], delayMinHours: 3, delayMaxHours: 12,
  };

  it('concatenates the power profiles end to end with no gap', () => {
    const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 0);

    expect(composed.powerProfileKwh).toEqual([...washer.powerProfileKwh, ...dryer.powerProfileKwh]);
    expect(composed.cycleMinutes).toBe(410);
  });

  it('takes the delay range from the first profile only, since only its delay is settable', () => {
    const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 0);

    expect(composed.delayMinHours).toBe(3);
    expect(composed.delayMaxHours).toBe(12);
  });

  it('inserts a zero-power gap slot for a non-zero transfer gap', () => {
    const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 30);

    expect(composed.powerProfileKwh).toEqual([...washer.powerProfileKwh, 0, ...dryer.powerProfileKwh]);
    expect(composed.cycleMinutes).toBe(440);
  });

  it('leaves an early bucket empty when the composed cycle is too long for it to be feasible, rather than needing a delayMinHours fix', () => {
    // washer (130min) + dryer (280min) is a 6h50 cycle; the inherited 3h
    // minimum delay can't actually fit it - the per-hour feasibility check
    // should just skip those hours rather than needing composeProfiles to
    // special-case its own delayMinHours.
    const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 0);
    const slots = run(0, 24, 10);
    const { buckets } = planAppliance({ slots, now: at(0), profile: composed })!;

    expect(buckets[0].option).toBeNull(); // 3-6h: nothing fits a 6h50 cycle
    expect(buckets[2].option).not.toBeNull(); // 9-12h: plenty of room
  });
});
