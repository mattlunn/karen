import dayjs from '../../../../dayjs';
import { PriceSlot, startOfSlot } from '../../../../helpers/prices';

export interface ApplianceProfile {
  id: string;
  label: string;
  // For a composed profile (e.g. wash then dry), the whole sequence, not just the settable leg.
  fullElapsedDuration: number;
  // The settable leg's own duration - its dial has no idea what runs after it.
  dialCycleMinutes: number;
  powerProfileKwh: number[];
  delayMinHours: number;
  delayMaxHours: number;
}

const BUCKET_COUNT = 3;

export interface DelayOption {
  dialHours: number;
  costPence: number;
  savingPercent: number;
  penceDifference: number;
  isBelowNegligibleSavingsPence: boolean;
  // Costed against a prior day's prices backfilled for a slot Agile hasn't published yet.
  isEstimated: boolean;
}

export interface DelayBucket {
  // A whole-run-finishes-within-[from, to] window, not a dial range.
  from: number;
  to: number;
  // Null renders as "£££".
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

interface WindowCost {
  pence: number;
  isEstimated: boolean;
}

// Sums profile.powerProfileKwh against pool from startIndex, or null if it overruns pool or hits a gap.
function costOfWindow(pool: PriceSlot[], startIndex: number, profile: ApplianceProfile): WindowCost | null {
  const len = profile.powerProfileKwh.length;

  if (startIndex < 0 || startIndex + len > pool.length) {
    return null;
  }

  let pence = 0;
  let isEstimated = false;

  for (let i = 0; i < len; i++) {
    const slot = pool[startIndex + i];

    if (i > 0 && slot.start.getTime() !== pool[startIndex + i - 1].end.getTime()) {
      return null;
    }

    pence += profile.powerProfileKwh[i] * slot.pence;
    isEstimated = isEstimated || slot.isEstimated === true;
  }

  return { pence, isEstimated };
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

  const costNow = costOfWindow(pool, 0, profile);

  if (costNow === null) {
    return null;
  }

  const costNowPence = costNow.pence;

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
    const cost = costOfWindow(pool, indexOfSlotStarting(pool, start), profile);

    if (cost === null) {
      continue;
    }

    const costPence = cost.pence;

    const wholeRunFinishesIn = dial + downstreamHours;

    // Finishing outside the promised window isn't a genuine option.
    if (wholeRunFinishesIn > profile.delayMaxHours) {
      continue;
    }

    const bucket = buckets[Math.min(BUCKET_COUNT - 1, Math.floor((wholeRunFinishesIn - profile.delayMinHours) / (span / BUCKET_COUNT)))];
    const penceDifference = Math.abs(costNowPence - costPence);
    // costNowPence's magnitude, not its signed value, keeps this correctly signed when running now is a payout.
    const savingPercent = Math.round((costNowPence - costPence) / Math.abs(costNowPence) * 100);
    const option = {
      dialHours: dial,
      costPence,
      savingPercent,
      penceDifference,
      isBelowNegligibleSavingsPence: penceDifference < negligibleSavingPence,
      isEstimated: cost.isEstimated,
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
