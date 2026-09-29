import { detectRuns, PowerReading } from './appliance-runs';

const base = new Date('2026-01-01T00:00:00.000Z');

function at(minutesFromBase: number): Date {
  return new Date(base.getTime() + minutesFromBase * 60_000);
}

function readings(entries: [number, number][]): PowerReading[] {
  return entries.map(([minute, value]) => ({ start: at(minute), value }));
}

describe('detectRuns', () => {
  it('merges a dishwasher-shaped trace (idle dips + two heater bursts) into one run', () => {
    const entries: [number, number][] = [[-30, 5]];

    for (let minute = 0; minute < 140; minute += 5) {
      if (minute === 10 || minute === 120) {
        entries.push([minute, 2000]);
      } else if (minute === 35 || minute === 75) {
        entries.push([minute, 7]);
      } else {
        entries.push([minute, 30]);
      }
    }

    entries.push([140, 5]);
    entries.push([400, 3]);

    const now = at(400);
    const runs = detectRuns(readings(entries), now);

    expect(runs).toHaveLength(1);
    expect(runs[0].start).toEqual(at(0));
    expect(runs[0].end).toEqual(at(140));
    expect(runs[0].isOpen).toBe(false);
  });

  it('detects a washer-shaped trace as a single run', () => {
    const entries: [number, number][] = [[-30, 4]];

    for (let minute = 0; minute < 60; minute += 5) {
      entries.push([minute, minute === 30 ? 8 : 40]);
    }

    entries.push([60, 4]);
    entries.push([300, 4]);

    const now = at(300);
    const runs = detectRuns(readings(entries), now);

    expect(runs).toHaveLength(1);
    expect(runs[0].start).toEqual(at(0));
    expect(runs[0].end).toEqual(at(60));
  });

  it('ignores brief sub-threshold-duration blips', () => {
    const entries: [number, number][] = [
      [0, 25],
      [3, 4],
      [60, 25],
      [63, 4],
      [120, 25],
      [124, 4],
    ];

    const now = at(200);
    const runs = detectRuns(readings(entries), now);

    expect(runs).toHaveLength(0);
  });

  it('marks a still-running appliance as an open run', () => {
    const entries: [number, number][] = [
      [-10, 3],
      [0, 30],
    ];

    const now = at(35);
    const runs = detectRuns(readings(entries), now);

    expect(runs).toHaveLength(1);
    expect(runs[0].start).toEqual(at(0));
    expect(runs[0].end).toEqual(now);
    expect(runs[0].isOpen).toBe(true);
  });

  it('keeps two runs separate when the gap between them is >= MAX_GAP_MINUTES', () => {
    const entries: [number, number][] = [];

    for (let minute = 0; minute < 40; minute += 5) {
      entries.push([minute, 30]);
    }

    // 25-minute idle gap: the run ends at 40, the next one starts at 65.
    entries.push([40, 5]);

    for (let minute = 65; minute < 100; minute += 5) {
      entries.push([minute, 30]);
    }

    entries.push([100, 4]);

    const now = at(150);
    const runs = detectRuns(readings(entries), now);

    expect(runs).toHaveLength(2);
    expect(runs[0].start).toEqual(at(0));
    expect(runs[0].end).toEqual(at(40));
    expect(runs[1].start).toEqual(at(65));
    expect(runs[1].end).toEqual(at(100));
  });
});
