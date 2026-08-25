jest.mock('../config/app', () => ({}), { virtual: true });

import setIntervalForTime from './set-interval-for-time';

function getTime(hour, minute, second = 0, millisecond = 0) {
  return new Date(2026, 0, 1, hour, minute, second, millisecond);
}

describe('setIntervalForTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const HOUR = 60 * 60 * 1000;

  it.each([
    // Comfortably outside MINIMUM_DELAY_MS: fires later today, once.
    ['2 seconds before the target', getTime(16, 59, 58, 0), 3000],
    // Within MINIMUM_DELAY_MS of "now": today's occurrence is skipped, fires tomorrow, once.
    ['exactly on the target', getTime(17, 0, 0, 0), 25 * HOUR],
    ['1ms after the target', getTime(17, 0, 0, 1), 25 * HOUR],
  ])('calls func exactly once when the timer fires %s', (_, now, advanceBy) => {
    jest.setSystemTime(now);

    const func = jest.fn();

    setIntervalForTime(func, '17:00');
    jest.advanceTimersByTime(advanceBy);

    expect(func).toHaveBeenCalledTimes(1);
  });
});
