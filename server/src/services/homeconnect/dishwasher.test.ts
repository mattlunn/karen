import { pickRunWindow } from './dishwasher';

const T0 = new Date('2026-01-01T00:00:00Z');

function at(hours: number): Date {
  return new Date(T0.getTime() + hours * 60 * 60 * 1000);
}

function rate(fromHour: number, toHour: number, pence: number) {
  return { start: at(fromHour), end: at(toHour), value: pence };
}

describe('pickRunWindow', () => {
  it('picks the cheapest contiguous window long enough for the run', () => {
    const window = pickRunWindow([
      rate(0, 2, 20),
      rate(2, 4, 5),
      rate(4, 12, 20),
    ], at(0), at(12), 120);

    expect(window).toEqual({ start: at(2), end: at(4), averagePence: 5 });
  });

  it('never picks a window that would run past the horizon', () => {
    const window = pickRunWindow([
      rate(0, 11.5, 20),
      rate(11.5, 14, 1),
    ], at(0), at(12), 120);

    expect(window!.end.getTime()).toBeLessThanOrEqual(at(12).getTime());
  });

  it('returns null when the published prices are shorter than the run', () => {
    expect(pickRunWindow([rate(0, 1, 20)], at(0), at(12), 120)).toBeNull();
  });
});
