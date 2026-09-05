import dayjs from '../../../../dayjs';
import { PriceSlot, startOfSlot } from '../../../../helpers/prices';

export interface ApplianceProfile {
  id: string;
  label: string;
  cycleMinutes: number;
  // kWh consumed per 30-minute slot from the start of the cycle.
  powerProfileKwh: number[];
  // Neither machine offers a delay under a few hours, so a delay setting is
  // only ever chosen from [delayMinHours, delayMaxHours].
  delayMinHours: number;
  delayMaxHours: number;
}

// How many equal-width slices [delayMinHours, delayMaxHours] is split into.
// Ranking every whole hour by cost and taking the N cheapest overall tends to
// cluster them all in whichever end of the window is currently cheapest (e.g.
// 9h/10h/11h/12h back to back) instead of spreading across the window - fixed
// buckets guarantee one representative option per slice of the day instead.
const BUCKET_COUNT = 3;

export interface DelayOption {
  hours: number;
  costPence: number;
  savingPercent: number;
}

export interface DelayBucket {
  from: number;
  to: number;
  // null when no whole hour in [from, to] can be costed - the panel renders
  // this as "£££" rather than leaving the column blank.
  option: DelayOption | null;
}

export interface RowPlan {
  costNowPence: number;
  // BUCKET_COUNT entries, chronological (by construction - bucket i always
  // covers earlier hours than bucket i + 1).
  buckets: DelayBucket[];
  // The cheapest option across all buckets, for the highlighted column. Null
  // only when every bucket is empty.
  best: DelayOption | null;
}

export interface PlanApplianceOptions {
  slots: PriceSlot[];
  now: Date;
  profile: ApplianceProfile;
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
  const { slots, now, profile } = options;
  const pool = slots
    .filter(s => s.end > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const costNowPence = costOfWindow(pool, 0, profile);

  if (costNowPence === null) {
    return null;
  }

  const cycleHours = profile.cycleMinutes / 60;
  const span = profile.delayMaxHours - profile.delayMinHours;
  const buckets: DelayBucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    from: Math.round(profile.delayMinHours + (span / BUCKET_COUNT) * i),
    to: Math.round(profile.delayMinHours + (span / BUCKET_COUNT) * (i + 1)),
    option: null,
  }));

  for (let hours = profile.delayMinHours; hours <= profile.delayMaxHours; hours++) {
    const start = startOfSlot(dayjs(now).add(hours, 'hour').subtract(cycleHours, 'hour').toDate());
    const costPence = costOfWindow(pool, indexOfSlotStarting(pool, start), profile);

    if (costPence === null) {
      continue;
    }

    const bucket = buckets[Math.min(BUCKET_COUNT - 1, Math.floor((hours - profile.delayMinHours) / (span / BUCKET_COUNT)))];
    const option = { hours, costPence, savingPercent: Math.round((costNowPence - costPence) / costNowPence * 100) };

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
 * for costing. `cycleMinutes`, `delayMinHours` and `delayMaxHours` come from
 * the first profile only, since only its delay is actually settable on the
 * machine - the downstream leg has no dial of its own to convert into.
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
    cycleMinutes: profiles.reduce((sum, p) => sum + p.cycleMinutes, 0) + transferGapMinutes * (profiles.length - 1),
    powerProfileKwh,
    delayMinHours: first.delayMinHours,
    delayMaxHours: first.delayMaxHours,
  };
}
