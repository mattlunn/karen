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
  id: 'test', label: 'Test', cycleMinutes: 30, powerProfileKwh: [1], delayMinHours: 0, delayMaxHours: 24,
};

function plan(slots: PriceSlot[], overrides: Partial<PlanApplianceOptions> = {}) {
  return planAppliance({
    slots, now: at(0), profile: oneSlotProfile, ...overrides,
  });
}

describe('planAppliance - cost now', () => {
  it('weights each slot in the cycle by its own power-profile entry', () => {
    const profile: ApplianceProfile = { id: 't', label: 'T', cycleMinutes: 60, powerProfileKwh: [2, 1], delayMinHours: 0, delayMaxHours: 24 };
    const slots = [{ start: at(0), end: at(0.5), pence: 5 }, { start: at(0.5), end: at(1), pence: 3 }];

    expect(plan(slots, { profile })!.costNowPence).toBe(2 * 5 + 1 * 3);
  });

  it('returns null when the cycle cannot even be costed starting immediately', () => {
    const profile: ApplianceProfile = {
      id: 'washer', label: 'Washer', cycleMinutes: 130, powerProfileKwh: [0.45, 0.2, 0.1, 0.1, 0.05], delayMinHours: 0, delayMaxHours: 19,
    };

    expect(plan(run(0, 1, 10), { profile })).toBeNull();
  });
});

describe('planAppliance - delay options', () => {
  it('returns the 4 cheapest whole-hour delays in chronological order', () => {
    // A 30-minute cycle means an "N hour" delay always starts on the slot at
    // N - 0.5h; make exactly those slots cheap for delays of 2, 5, 8, 11h.
    const cheapStarts = new Set([1.5, 4.5, 7.5, 10.5].map(h => at(h).getTime()));
    const slots = run(0, 24, 10).map(s => (cheapStarts.has(s.start.getTime()) ? { ...s, pence: 1 } : s));
    const { options, best } = plan(slots)!;

    expect(options.map(o => o.hours)).toEqual([2, 5, 8, 11]);
    expect(options.every(o => o.costPence === 1)).toBe(true);
    expect(best.hours).toBe(2); // ties broken by whichever sorts first when costs are equal
  });

  it('only considers delays within [delayMinHours, delayMaxHours]', () => {
    const profile: ApplianceProfile = { ...oneSlotProfile, delayMinHours: 3, delayMaxHours: 6 };
    // Cheapest slot of all is hour 1, but that's below the 3h minimum delay.
    const slots = [...run(0, 1, 1), ...run(1, 24, 10)];
    const { options, best } = plan(slots, { profile })!;

    expect(options.every(o => o.hours >= 3 && o.hours <= 6)).toBe(true);
    expect(best.hours).toBeGreaterThanOrEqual(3);
  });

  it('computes each option\'s saving relative to running immediately', () => {
    // A 1h delay starts at 0.5h (1h minus the 30-minute cycle).
    const slots = [...run(0, 0.5, 20), ...run(0.5, 1, 5), ...run(1, 24, 20)];
    const { options } = plan(slots)!;
    const oneHour = options.find(o => o.hours === 1)!;

    expect(oneHour.costPence).toBe(5);
    expect(oneHour.savingPercent).toBe(75); // (20 - 5) / 20 * 100
  });

  it('returns null when nothing in [delayMinHours, delayMaxHours] fits the forecast horizon', () => {
    const profile: ApplianceProfile = { ...oneSlotProfile, delayMinHours: 20, delayMaxHours: 24 };

    expect(plan(run(0, 10, 5), { profile })).toBeNull();
  });
});

describe('composeProfiles', () => {
  const washer: ApplianceProfile = {
    id: 'washing_machine', label: 'Washing machine', cycleMinutes: 130, powerProfileKwh: [0.45, 0.2, 0.1, 0.1, 0.05], delayMinHours: 3, delayMaxHours: 19,
  };
  const dryer: ApplianceProfile = {
    id: 'tumble_dryer', label: 'Tumble dryer', cycleMinutes: 150, powerProfileKwh: [0.55, 0.5, 0.5, 0.45, 0.4], delayMinHours: 3, delayMaxHours: 24,
  };

  it('concatenates the power profiles end to end with no gap', () => {
    const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 0);

    expect(composed.powerProfileKwh).toEqual([...washer.powerProfileKwh, ...dryer.powerProfileKwh]);
    expect(composed.cycleMinutes).toBe(280);
  });

  it('takes the delay range from the first profile only, since only its delay is settable', () => {
    const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 0);

    expect(composed.delayMinHours).toBe(3);
    expect(composed.delayMaxHours).toBe(19);
  });

  it('inserts a zero-power gap slot for a non-zero transfer gap', () => {
    const composed = composeProfiles('wash_then_dry', 'Wash → dry', [washer, dryer], 30);

    expect(composed.powerProfileKwh).toEqual([...washer.powerProfileKwh, 0, ...dryer.powerProfileKwh]);
    expect(composed.cycleMinutes).toBe(310);
  });
});
