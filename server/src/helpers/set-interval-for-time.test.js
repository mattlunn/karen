jest.mock('../config/app', () => ({}), { virtual: true });

import setIntervalForTime from './set-interval-for-time';

function getTime(hour, minute, second = 0, millisecond = 0) {
  return new Date(2026, 0, 1, hour, minute, second, millisecond);
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('setIntervalForTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires later today when the target hasn\'t passed yet', () => {
    jest.setSystemTime(getTime(16, 59, 58, 0));

    const func = jest.fn();

    setIntervalForTime(func, '17:00');
    jest.advanceTimersByTime(3000);

    expect(func).toHaveBeenCalledTimes(1);
  });

  it.each([
    // Fires immediately (today's occurrence, ~0ms delay).
    ['exactly on the target', getTime(17, 0, 0, 0), HOUR],
    // Already passed (strictly), so rolls over to tomorrow instead of firing immediately.
    ['1ms after the target', getTime(17, 0, 0, 1), DAY + HOUR],
  ])('does not double-fire when the timer starts %s', (_, now, advanceBy) => {
    jest.setSystemTime(now);

    const func = jest.fn();

    setIntervalForTime(func, '17:00');
    jest.advanceTimersByTime(advanceBy);

    expect(func).toHaveBeenCalledTimes(1);
  });

  it('fires exactly once per day across multiple days', () => {
    jest.setSystemTime(getTime(16, 59, 58, 0));

    const func = jest.fn();

    setIntervalForTime(func, '17:00');
    jest.advanceTimersByTime(3 * DAY);

    expect(func).toHaveBeenCalledTimes(3);
  });

  describe('DST transitions (Europe/London)', () => {
    // UK clocks go forward 01:00->02:00 on 2026-03-29 (that day is 23 hours long), and back
    // 02:00->01:00 on 2026-10-25 (that day is 25 hours long). A naive `.add(1, 'day')` reschedule
    // would fire an hour late/early on these days instead of at 17:00 local time.
    it.each([
      ['BST starts (23-hour day)', new Date(Date.UTC(2026, 2, 28, 12, 0, 0)), [23 * HOUR, 24 * HOUR]],
      ['BST ends (25-hour day)', new Date(Date.UTC(2026, 9, 24, 12, 0, 0)), [25 * HOUR, 24 * HOUR]],
    ])('reschedules for local 17:00, not a flat 24h, across %s', (_, now, expectedGapsMs) => {
      jest.setSystemTime(now);

      const callTimes = [];
      const func = jest.fn(() => callTimes.push(Date.now()));

      setIntervalForTime(func, '17:00');
      jest.advanceTimersByTime(3 * DAY);

      expect(callTimes).toHaveLength(3);
      expect(callTimes[1] - callTimes[0]).toBe(expectedGapsMs[0]);
      expect(callTimes[2] - callTimes[1]).toBe(expectedGapsMs[1]);
    });
  });
});
