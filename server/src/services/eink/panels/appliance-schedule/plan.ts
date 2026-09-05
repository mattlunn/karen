import dayjs from '../../../../dayjs';
import { PriceSlot, startOfSlot } from '../../../../helpers/prices';

export interface ApplianceProfile {
  id: string;
  label: string;
  // Full elapsed duration - for display, and for how many price slots
  // powerProfileKwh implies. For a composed profile (e.g. wash then dry)
  // this is the whole sequence, not just the leg with a settable delay.
  cycleMinutes: number;
  // The duration of the one leg whose delay is actually settable on a
  // physical dial - equal to cycleMinutes for a standalone appliance, but
  // just the washer's own duration for a composed wash-then-dry profile,
  // since the washer's "finished in N hours" control has no idea a dryer
  // runs afterward. Used to find which price window a given dial setting
  // actually costs.
  dialCycleMinutes: number;
  // kWh consumed per 30-minute slot from the start of the cycle.
  powerProfileKwh: number[];
  // The dial's own physical range, e.g. neither machine offers a delay
  // under a few hours. Also doubles as the window the columns promise the
  // whole run will finish within (see BUCKET_COUNT) - the two coincide for
  // a standalone appliance, since dial setting and whole-run completion are
  // the same number when there's no downstream leg.
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
  // The dial setting - what to actually turn the knob to. For wash-then-dry
  // this is the washer's own setting; the dryer isn't dialed at all, it's
  // just started once the wash is done.
  hours: number;
  costPence: number;
  savingPercent: number;
}

export interface DelayBucket {
  // The window of "whole run finishes in [from, to] hours from now" this
  // column represents - not a range of dial settings. They're the same
  // thing for a standalone appliance, but for wash-then-dry the dial
  // setting inside `option` is earlier than `to` by the dryer's own
  // duration, since the dryer still has to run after the dial's own cycle.
  from: number;
  to: number;
  // null when nothing in [from, to] can be costed - the panel renders this
  // as "£££" rather than leaving the column blank.
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

  const dialCycleHours = profile.dialCycleMinutes / 60;
  // Time from the dial leg finishing to the whole run finishing - zero for a
  // standalone appliance, the dryer's own duration for wash-then-dry. Added
  // to the dial setting, this is what the bucket the column headers show
  // ("this bucket is when the whole run finishes") actually needs.
  const downstreamHours = profile.cycleMinutes / 60 - dialCycleHours;
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

    // A dial setting whose downstream leg would finish outside the window
    // the columns promise ("done within delayMaxHours") isn't a genuine
    // option for that window, even though the dial itself is in range.
    if (wholeRunFinishesIn > profile.delayMaxHours) {
      continue;
    }

    const bucket = buckets[Math.min(BUCKET_COUNT - 1, Math.floor((wholeRunFinishesIn - profile.delayMinHours) / (span / BUCKET_COUNT)))];
    const option = { hours: dial, costPence, savingPercent: Math.round((costNowPence - costPence) / costNowPence * 100) };

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
 * for costing. `dialCycleMinutes`, `delayMinHours` and `delayMaxHours` come
 * from the first profile only, since only its delay is actually settable on
 * the machine - the downstream leg has no dial of its own to convert into.
 * `cycleMinutes` (and the price slots costed) still cover the whole sequence.
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
    dialCycleMinutes: first.dialCycleMinutes,
    powerProfileKwh,
    delayMinHours: first.delayMinHours,
    delayMaxHours: first.delayMaxHours,
  };
}
