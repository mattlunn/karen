import { timeWeightedAverage } from './time-weighted-average';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 24, 12, minute));

describe('timeWeightedAverage', () => {
  it('weights each value by how long it lasted', () => {
    const events = [
      { value: 1.2, start: at(0), end: at(7) },
      { value: 0.8, start: at(7), end: at(10) }
    ];

    expect(timeWeightedAverage(events, at(0), at(10))).toBeCloseTo(1.08);
  });

  it('clips events that straddle the window', () => {
    const events = [
      { value: 2, start: at(-30), end: at(5) },
      { value: 1, start: at(5), end: at(30) }
    ];

    expect(timeWeightedAverage(events, at(0), at(10))).toBeCloseTo(1.5);
  });

  it('treats an open event as lasting until the end of the window', () => {
    const events = [
      { value: 1, start: at(0), end: at(5) },
      { value: 2, start: at(5), end: null }
    ];

    expect(timeWeightedAverage(events, at(0), at(10))).toBeCloseTo(1.5);
  });

  it('averages over only the covered part of the window', () => {
    const events = [{ value: 1.4, start: at(6), end: null }];

    expect(timeWeightedAverage(events, at(0), at(10))).toBeCloseTo(1.4);
  });

  it('returns null when nothing overlaps the window', () => {
    expect(timeWeightedAverage([], at(0), at(10))).toBeNull();
    expect(timeWeightedAverage([{ value: 1, start: at(-10), end: at(-5) }], at(0), at(10))).toBeNull();
  });
});
