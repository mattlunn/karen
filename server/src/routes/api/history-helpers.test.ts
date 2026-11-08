jest.mock('../../config', () => ({}));
jest.mock('../../models', () => ({}));

import { bucketByDay, daysInRange, daysToLineData } from './history-helpers';

const dayEvent = (start: string, end: string, value: number) => ({ start, end, lastReported: end, value });

describe('daysInRange', () => {
  it('keeps every day on London midnight across the autumn clock change', () => {
    expect(daysInRange(new Date('2026-10-23T23:00:00.000Z'), new Date('2026-10-28T00:00:00.000Z'))).toEqual([
      '2026-10-23T23:00:00.000Z',
      '2026-10-24T23:00:00.000Z',
      '2026-10-26T00:00:00.000Z',
      '2026-10-27T00:00:00.000Z',
    ]);
  });

  it('keeps every day on London midnight across the spring clock change', () => {
    expect(daysInRange(new Date('2026-03-28T00:00:00.000Z'), new Date('2026-03-31T00:00:00.000Z'))).toEqual([
      '2026-03-28T00:00:00.000Z',
      '2026-03-29T00:00:00.000Z',
      '2026-03-29T23:00:00.000Z',
      '2026-03-30T23:00:00.000Z',
    ]);
  });
});

describe('bucketByDay', () => {
  it('keys a 25-hour day once, matching the days daysInRange produces', () => {
    const since = '2026-10-23T23:00:00.000Z';
    const until = '2026-10-28T00:00:00.000Z';
    const byDay = bucketByDay({
      since,
      until,
      history: [
        dayEvent('2026-10-23T23:00:00.000Z', '2026-10-24T23:00:00.000Z', 1),
        dayEvent('2026-10-24T23:00:00.000Z', '2026-10-26T00:00:00.000Z', 2),
        dayEvent('2026-10-26T00:00:00.000Z', '2026-10-27T00:00:00.000Z', 3),
        dayEvent('2026-10-27T00:00:00.000Z', '2026-10-28T00:00:00.000Z', 4),
      ]
    });

    expect([...byDay.keys()]).toEqual(daysInRange(new Date(since), new Date(until)));
    expect([...byDay.values()]).toEqual([1, 2, 3, 4]);
  });
});

describe('daysToLineData', () => {
  it('ends the day of the clock change at the next London midnight', () => {
    const { history } = daysToLineData(['2026-10-24T23:00:00.000Z'], '', '', () => 1);

    expect(history[0].end).toBe('2026-10-26T00:00:00.000Z');
  });
});
