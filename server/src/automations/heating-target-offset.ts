export interface ActiveOffsetWindow {
  end: Date;
  offset: number;
}

function isSameTemperature(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.05;
}

// The target to set, or null to leave the room as it is. A room counts as
// changed by hand when its target is none that Karen or Tado would set: its
// schedule, its due warm-up (`base`), its away setback, or either of the first
// two plus one of the configured offsets.
export function resolveOffsetTarget({ scheduled, base, setback, offset, configuredOffsets, current }: {
  scheduled: number;
  base: number;
  setback: number;
  offset: number;
  configuredOffsets: number[];
  current: number;
}): number | null {
  const desired = base + offset;
  const untouched = [scheduled, base, setback, ...configuredOffsets.flatMap(o => [scheduled + o, base + o])];

  if (!untouched.some(t => isSameTemperature(current, t))) {
    return null;
  }

  return isSameTemperature(current, desired) ? null : desired;
}
