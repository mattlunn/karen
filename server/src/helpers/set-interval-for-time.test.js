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
});
