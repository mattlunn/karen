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
  id: 'test', label: 'Test', cycleMinutes: 30, dialCycleMinutes: 30, powerProfileKwh: [1], delayMinHours: 3, delayMaxHours: 12,
};

function plan(slots: PriceSlot[], overrides: Partial<PlanApplianceOptions> = {}) {
  return planAppliance({
    slots, now: at(0), profile: oneSlotProfile, negligibleSavingPence: 0, ...overrides,
  });
}

describe('planAppliance - cost now', () => {
  it('weights each slot in the cycle by its own power-profile entry', () => {
    const profile: ApplianceProfile = { id: 't', label: 'T', cycleMinutes: 60, dialCycleMinutes: 60, powerProfileKwh: [2, 1], delayMinHours: 3, delayMaxHours: 12 };
    const slots = [{ start: at(0), end: at(0.5), pence: 5 }, { start: at(0.5), end: at(1), pence: 3 }];

    expect(plan(slots, { profile })!.costNowPence).toBe(2 * 5 + 1 * 3);
  });

  it('returns null when the cycle cannot even be costed starting immediately', () => {
    const profile: ApplianceProfile = {
      id: 'washer', label: 'Washer', cycleMinutes: 130, dialCycleMinutes: 130, powerProfileKwh: [0.45, 0.2, 0.1, 0.1, 0.05], delayMinHours: 3, delayMaxHours: 12,
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
    // Prices fall monotonically from hour 3 to hour 12, so the cheapest
    // hour within each third of the window is progressively later - each
    // bucket's own slice, not all three clustered at one end of the window.
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

    expect(best).toEqual({ hours: 5, costPence: 1, savingPercent: 90, penceDifference: 9, negligible: false });
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

  it('keeps the saving\'s sign meaningful when running now is itself negative', () => {
    // costNow (-2) is already a payout. A 4h delay (-5, a bigger payout)
    // must read as a positive saving, and a 5h delay (10, an actual cost)
    // must read as negative - dividing by the signed costNow would flip
    // both of these the wrong way round.
    const slots = [...run(0, 3.5, -2), ...run(3.5, 4, -5), ...run(4, 4.5, 10), ...run(4.5, 24, -2)];
    const { buckets } = plan(slots)!;

    expect(buckets[0].option).toEqual({ hours: 4, costPence: -5, savingPercent: 150, penceDifference: 3, negligible: false }); // (-2 - -5) / 2 * 100
    expect(buckets[0].option!.savingPercent).toBeGreaterThan(0);
  });

  it('flags an option as negligible once it is within negligibleSavingPence of running now, however large the percentage looks', () => {
    // costNow (1) is tiny, so even half a pence of difference produces a
    // 50% savingPercent - negligible is what the panel actually keys "Same"
    // off, independent of that percentage.
    const profile: ApplianceProfile = { ...oneSlotProfile, delayMinHours: 1 };
    const slots = [...run(0, 0.5, 1), ...run(0.5, 1, 0.5), ...run(1, 24, 1)];
    const { buckets } = plan(slots, { profile, negligibleSavingPence: 10 })!;
    const oneHour = buckets[0].option!;

    expect(oneHour.hours).toBe(1);
    expect(oneHour.savingPercent).toBe(50); // (1 - 0.5) / 1 * 100
    expect(oneHour.penceDifference).toBe(0.5);
    expect(oneHour.negligible).toBe(true);
  });

  it('does not flag an option as negligible once it clears the threshold', () => {
    const slots = [...run(0, 2.5, 20), ...run(2.5, 3, 5), ...run(3, 24, 20)];
    const { buckets } = plan(slots, { negligibleSavingPence: 10 })!;

    expect(buckets[0].option!.penceDifference).toBe(15);
    expect(buckets[0].option!.negligible).toBe(false);
  });
});

describe('composeProfiles', () => {
  const washer: ApplianceProfile = {
    id: 'washing_machine', label: 'Washing machine', cycleMinutes: 130, dialCycleMinutes: 130, powerProfileKwh: [0.45, 0.2, 0.1, 0.1, 0.05], delayMinHours: 3, delayMaxHours: 12,
  };
  const dryer: ApplianceProfile = {
    id: 'tumble_dryer', label: 'Tumble dryer', cycleMinutes: 280, dialCycleMinutes: 280, powerProfileKwh: [0.55, 0.5, 0.5, 0.45, 0.4], delayMinHours: 3, delayMaxHours: 12,
  };

  it('concatenates the power profiles end to end with no gap', () => {
    const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 0);

    expect(composed.powerProfileKwh).toEqual([...washer.powerProfileKwh, ...dryer.powerProfileKwh]);
    expect(composed.cycleMinutes).toBe(410);
  });

  it('takes the delay range and dial duration from the first profile only, since only its delay is settable', () => {
    const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 0);

    expect(composed.delayMinHours).toBe(3);
    expect(composed.delayMaxHours).toBe(12);
    expect(composed.dialCycleMinutes).toBe(130); // the washer's own duration, not the combined 410
  });

  it('inserts a zero-power gap slot for a non-zero transfer gap', () => {
    const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 30);

    expect(composed.powerProfileKwh).toEqual([...washer.powerProfileKwh, 0, ...dryer.powerProfileKwh]);
    expect(composed.cycleMinutes).toBe(440);
  });
});

describe('composeProfiles - buckets are keyed by when the whole run finishes, not by the dial value', () => {
  // A 2h dial leg (the washer) followed by a 2h downstream leg (the dryer) -
  // uniform per-slot weights, so cost depends only on whether a window
  // happens to include the one cheap slot below, isolating which start
  // times get explored from how they're priced.
  const washer: ApplianceProfile = {
    id: 'washer', label: 'Washer', cycleMinutes: 120, dialCycleMinutes: 120, powerProfileKwh: [1, 1, 1, 1], delayMinHours: 3, delayMaxHours: 9,
  };
  const dryer: ApplianceProfile = {
    id: 'dryer', label: 'Dryer', cycleMinutes: 120, dialCycleMinutes: 120, powerProfileKwh: [1, 1, 1, 1], delayMinHours: 3, delayMaxHours: 9,
  };
  const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 0);

  it('excludes a dial setting whose downstream leg would finish after delayMaxHours, even though the dial itself is in range', () => {
    // Dialing 8h or 9h into the washer is mechanically valid (it's within
    // [delayMinHours, delayMaxHours]), but the dryer's own 2h afterward
    // would finish at 10h/11h - past the 9h the columns promise the whole
    // run finishes within. Neither should appear as an option anywhere.
    const { buckets } = planAppliance({ slots: run(0, 24, 10), now: at(0), profile: composed, negligibleSavingPence: 0 })!;
    const hoursShown = buckets.flatMap(b => (b.option ? [b.option.hours] : []));

    expect(hoursShown).not.toContain(8);
    expect(hoursShown).not.toContain(9);
  });

  it('leaves the earliest bucket empty when even the minimum dial setting finishes too late for it', () => {
    // Minimum completion is delayMinHours (3) + the dryer's 2h = 5h, so
    // nothing can complete within the first bucket's 3-5h window.
    const { buckets } = planAppliance({ slots: run(0, 24, 10), now: at(0), profile: composed, negligibleSavingPence: 0 })!;

    expect(buckets[0].to).toBe(5);
    expect(buckets[0].option).toBeNull();
  });

  it('picks the cheapest dial setting whose whole run still finishes within the bucket, leaving room for the downstream leg', () => {
    // Only reachable by dialing 7h into the washer (completes the whole run
    // at 7h + 2h = 9h, the edge of what's shown) - start = now + 7h - 2h =
    // now + 5h, a window ending at now + 9h. Dialing 5h or 6h - the other
    // candidates whose completion also lands in this bucket - can't reach
    // this slot at all.
    const slots = run(0, 24, 10).map(s => (s.start.getTime() === at(8.5).getTime() ? { ...s, pence: 0 } : s));
    const { buckets } = planAppliance({ slots, now: at(0), profile: composed, negligibleSavingPence: 0 })!;

    expect(buckets[2]).toEqual({
      from: 7, to: 9, option: { hours: 7, costPence: 70, savingPercent: 13, penceDifference: 10, negligible: false },
    });
  });
});
