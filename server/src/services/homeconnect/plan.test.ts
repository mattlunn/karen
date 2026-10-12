import { planRun } from './plan';
import { PriceSlot } from '../../helpers/prices';

function slots(start: string, pences: number[], isEstimated = false): PriceSlot[] {
  return pences.map((pence, i) => ({
    start: new Date(new Date(start).getTime() + i * 30 * 60 * 1000),
    end: new Date(new Date(start).getTime() + (i + 1) * 30 * 60 * 1000),
    pence,
    isEstimated,
  }));
}

describe('planRun', () => {
  const now = new Date('2026-10-12T21:10:00Z');
  const finishBy = new Date('2026-10-13T06:00:00Z');

  it('picks the cheapest run that finishes by the deadline', () => {
    const prices = [
      ...slots('2026-10-12T21:00:00Z', [20, 18, 15, 12, 10, 8]),
      ...slots('2026-10-13T00:00:00Z', [5, 4, 3, 6, 9, 12, 15, 20, 25, 30, 35, 40]),
    ];

    const run = planRun(prices, 80, finishBy, now);

    expect(run.start).toBe('2026-10-13T00:00:00.000Z');
    expect(run.end).toBe('2026-10-13T01:20:00.000Z');
    expect(run.finishBy).toBe('2026-10-13T06:00:00.000Z');
  });

  it('never starts in the slot already under way', () => {
    const run = planRun(slots('2026-10-12T21:00:00Z', [1, 50, 50, 50]), 30, finishBy, now);

    expect(run.start).toBe('2026-10-12T21:30:00.000Z');
  });

  it('records where published prices end', () => {
    const prices = [
      ...slots('2026-10-12T21:30:00Z', [10, 10]),
      ...slots('2026-10-12T22:30:00Z', [5, 5], true),
    ];

    expect(planRun(prices, 60, finishBy, now).publishedEnd).toBe('2026-10-12T22:30:00.000Z');
  });

  it('throws when no run fits before the deadline', () => {
    expect(() => planRun(slots('2026-10-12T21:30:00Z', [10]), 60, finishBy, now)).toThrow('before');
  });
});
