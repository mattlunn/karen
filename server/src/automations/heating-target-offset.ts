export interface ActiveOffsetWindow {
  // Identifies this day's occurrence of the window.
  key: string;
  end: Date;
  offset: number;
}

// A null `value` means the room's target was changed by hand, so it's left
// alone for the rest of the window.
export interface OffsetWrite {
  windowKey: string;
  value: number | null;
}

function isSameTemperature(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.05;
}

// `untouchedTargets` are the targets a room can show without anyone having
// changed it by hand: its schedule, a warm-up towards the next block, or the
// away setback. They're only checked while someone's home to make that change.
export function resolveOffsetWrite({ window, base, current, untouchedTargets, previous, isSomeoneHome }: {
  window: ActiveOffsetWindow;
  base: number;
  current: number;
  untouchedTargets: number[];
  previous: OffsetWrite | undefined;
  isSomeoneHome: boolean;
}): { write: number | null; record: OffsetWrite } {
  const desired = base + window.offset;
  const isOurs = previous?.value != null && isSameTemperature(current, previous.value);
  const leaveAlone = { write: null, record: { windowKey: window.key, value: null } };

  if (previous?.windowKey === window.key) {
    if (!isOurs) {
      return leaveAlone;
    }

    return { write: isSameTemperature(desired, previous.value!) ? null : desired, record: { windowKey: window.key, value: desired } };
  }

  if (isSomeoneHome && !isOurs && !untouchedTargets.some(t => isSameTemperature(current, t))) {
    return leaveAlone;
  }

  return { write: desired, record: { windowKey: window.key, value: desired } };
}
