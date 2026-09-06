import dayjs from '../../../../dayjs';
import { PriceSlot, startOfSlot } from '../../../../helpers/prices';

export interface ApplianceProfile {
  id: string;
  label: string;
  // Whole sequence for a composed profile (e.g. wash then dry), not just the
  // leg with a settable delay - drives display and how many price slots
  // powerProfileKwh implies.
  fullElapsedDuration: number;
  // The settable leg's own duration - equal to fullElapsedDuration for a
  // standalone appliance, but just the washer's own time for wash-then-dry,
  // since its dial has no idea a dryer runs afterward.
  dialCycleMinutes: number;
  powerProfileKwh: number[];
  // The dial's own physical range. Also the window the columns promise the
  // whole run finishes within (see BUCKET_COUNT) - the two coincide for a
  // standalone appliance, since there's no downstream leg to push it later.
  delayMinHours: number;
  delayMaxHours: number;
}

const BUCKET_COUNT = 3;

export interface DelayOption {
  // What to actually turn the dial to. For wash-then-dry this is the
  // washer's own setting - the dryer isn't dialed, just started afterward.
  dialHours: number;
  costPence: number;
  savingPercent: number;
  // Always positive.
  penceDifference: number;
  // The panel shows "Same" instead of savingPercent below this threshold -
  // near a near-zero costNowPence, a tiny penceDifference still produces a
  // huge percentage.
  isBelowNegligibleSavingsPence: boolean;
}

export interface DelayBucket {
  // A "whole run finishes within [from, to]" window, not a dial range - for
  // wash-then-dry, option.dialHours is earlier than `to` by the dryer's own
  // duration.
  from: number;
  to: number;
  // Null renders as "£££" rather than a blank column.
  option: DelayOption | null;
}

export interface RowPlan {
  costNowPence: number;
  buckets: DelayBucket[];
  // Null only when every bucket is empty.
  best: DelayOption | null;
}

export interface PlanApplianceOptions {
  slots: PriceSlot[];
  now: Date;
  profile: ApplianceProfile;
  negligibleSavingPence: number;
}

// Sums `profile.powerProfileKwh[i] * pool[startIndex + i].pence`. Returns null
// when the window runs past the end of `pool` or a gap breaks the run - both
// mean the cycle can't actually be costed starting there.
function costOfWindow(pool: PriceSlot[], startIndex: number, profile: ApplianceProfile): number | null {
  const len = profile.powerProfileKwh.length;

  if (startIndex < 0 || startIndex + len > pool.length) {
    return null;
  }

  let pence = 0;

  for (let i = 0; i < len; i++) {
    const slot = pool[startIndex + i];

    if (i > 0 && slot.start.getTime() !== pool[startIndex + i - 1].end.getTime()) {
      return null;
    }

    pence += profile.powerProfileKwh[i] * slot.pence;
  }

  return pence;
}

function indexOfSlotStarting(pool: PriceSlot[], start: Date): number {
  return pool.findIndex(s => s.start.getTime() === start.getTime());
}

/**
 * Plans one appliance against the published price forecast. Returns null when
 * the cycle can't even be costed starting immediately - the "no price data"
 * case, where the row has nothing to show rather than a guess.
 */
export function planAppliance(options: PlanApplianceOptions): RowPlan | null {
  const { slots, now, profile, negligibleSavingPence } = options;
  const pool = slots
    .filter(s => s.end > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const costNowPence = costOfWindow(pool, 0, profile);

  if (costNowPence === null) {
    return null;
  }

  const dialCycleHours = profile.dialCycleMinutes / 60;
  // Zero for a standalone appliance, the dryer's own duration for wash-then-dry.
  const downstreamHours = profile.fullElapsedDuration / 60 - dialCycleHours;
  const span = profile.delayMaxHours - profile.delayMinHours;
  const buckets: DelayBucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    from: Math.round(profile.delayMinHours + (span / BUCKET_COUNT) * i),
    to: Math.round(profile.delayMinHours + (span / BUCKET_COUNT) * (i + 1)),
    option: null,
  }));

  for (let dial = profile.delayMinHours; dial <= profile.delayMaxHours; dial++) {
    const start = startOfSlot(dayjs(now).add(dial, 'hour').subtract(dialCycleHours, 'hour').toDate());
    const costPence = costOfWindow(pool, indexOfSlotStarting(pool, start), profile);

    if (costPence === null) {
      continue;
    }

    const wholeRunFinishesIn = dial + downstreamHours;

    // Finishing outside the window the columns promise isn't a genuine
    // option, even though the dial setting itself is in range.
    if (wholeRunFinishesIn > profile.delayMaxHours) {
      continue;
    }

    const bucket = buckets[Math.min(BUCKET_COUNT - 1, Math.floor((wholeRunFinishesIn - profile.delayMinHours) / (span / BUCKET_COUNT)))];
    const penceDifference = Math.abs(costNowPence - costPence);
    // Dividing by costNowPence's magnitude, not its signed value, so the
    // result stays correctly signed when running now is itself a payout.
    const savingPercent = Math.round((costNowPence - costPence) / Math.abs(costNowPence) * 100);
    const option = {
      dialHours: dial,
      costPence,
      savingPercent,
      penceDifference,
      isBelowNegligibleSavingsPence: penceDifference < negligibleSavingPence,
    };

    if (bucket.option === null || option.costPence < bucket.option.costPence) {
      bucket.option = option;
    }
  }

  const best = buckets.reduce<DelayOption | null>((min, bucket) => (
    bucket.option && (min === null || bucket.option.costPence < min.costPence) ? bucket.option : min
  ), null);

  return { costNowPence, buckets, best };
}

/**
 * Merges appliance profiles end-to-end (e.g. wash then dry) into one profile
 * for costing. dialCycleMinutes/delayMinHours/delayMaxHours come from the
 * first profile only - the downstream leg has no dial of its own.
 */
export function composeProfiles(id: string, label: string, profiles: ApplianceProfile[], transferGapMinutes: number): ApplianceProfile {
  const [first, ...rest] = profiles;
  const gapSlots = Math.round(transferGapMinutes / 30);
  const powerProfileKwh = [...first.powerProfileKwh];

  for (const profile of rest) {
    powerProfileKwh.push(...Array(gapSlots).fill(0), ...profile.powerProfileKwh);
  }

  return {
    id,
    label,
    fullElapsedDuration: profiles.reduce((sum, p) => sum + p.fullElapsedDuration, 0) + transferGapMinutes * (profiles.length - 1),
    dialCycleMinutes: first.dialCycleMinutes,
    powerProfileKwh,
    delayMinHours: first.delayMinHours,
    delayMaxHours: first.delayMaxHours,
  };
}
