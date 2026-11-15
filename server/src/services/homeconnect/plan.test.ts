import { planRun } from './plan';
import { PriceSlot } from '../../helpers/prices';

function slots(start: string, pences: number[]): PriceSlot[] {
  return pences.map((pence, i) => ({
    start: new Date(new Date(start).getTime() + i * 30 * 60 * 1000),
    end: new Date(new Date(start).getTime() + (i + 1) * 30 * 60 * 1000),
    pence,
    isEstimated: false,
  }));
}

// Front-loaded, like the dishwasher heating its water.
const PROFILE = [0.45, 0.11, 0.02];

describe('planRun', () => {
  const now = new Date('2026-10-12T21:10:00Z');

  it('picks the cheapest run, by its power profile, that finishes by the deadline', () => {
    const prices = [
      ...slots('2026-10-12T21:00:00Z', [20, 18, 15, 12, 10, 8]),
      ...slots('2026-10-13T00:00:00Z', [5, 4, 3, 6, 9, 12, 15, 20, 25, 30, 35, 40]),
    ];

    const run = planRun(prices, 80, PROFILE, new Date('2026-10-13T06:00:00Z'), now);

    // A flat load would start at 00:00 (4p average); weighted, starting on the 3p slot is cheaper.
    expect(run.start).toBe('2026-10-13T01:00:00.000Z');
    expect(run.end).toBe('2026-10-13T02:20:00.000Z');
    expect(run.finishBy).toBe('2026-10-13T06:00:00.000Z');
  });

  it('starts now when the slot already under way is cheapest', () => {
    const run = planRun(slots('2026-10-12T21:00:00Z', [1, 50, 50, 50, 50]), 30, PROFILE, new Date('2026-10-13T06:00:00Z'), now);

    expect(run.start).toBe('2026-10-12T21:10:00.000Z');
  });

  it('checks the deadline against the run itself, not whole slots', () => {
    // 22:00 + 80 minutes is 23:20, though its third slot runs to 23:30.
    const run = planRun(slots('2026-10-12T21:00:00Z', [50, 50, 50, 1, 1, 1, 50]), 80, PROFILE, new Date('2026-10-12T23:20:00Z'), now);

    expect(run.start).toBe('2026-10-12T22:00:00.000Z');
  });

  it('starts now when no later start can finish by the deadline', () => {
    const run = planRun(slots('2026-10-12T21:00:00Z', [50, 1, 1, 1, 1]), 80, PROFILE, new Date('2026-10-12T22:40:00Z'), now);

    expect(run.start).toBe('2026-10-12T21:10:00.000Z');
    expect(run.end).toBe('2026-10-12T22:30:00.000Z');
  });

  it('starts now even when that finishes after the deadline', () => {
    const run = planRun(slots('2026-10-12T21:00:00Z', [10, 10, 10, 10]), 80, PROFILE, new Date('2026-10-12T22:00:00Z'), now);

    expect(run.start).toBe('2026-10-12T21:10:00.000Z');
    expect(run.end).toBe('2026-10-12T22:30:00.000Z');
  });
});
