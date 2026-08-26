jest.mock('../config/app', () => ({}), { virtual: true });

import { isWithinTime, normalizeTime } from './time';
import getSunriseAndSunset from './sun';
import dayjs from '../dayjs';

jest.mock('./sun');

function getTime(hour, minute) {
  return dayjs().startOf('day').hour(hour).minute(minute);
}

describe('isWithinTime', () => {
  it('should return true when time is within normal start and end', () => {
    expect(isWithinTime('06:00', '07:00', getTime(6, 30))).toBe(true);
  });

  it.each([
    [5, 30],
    [7, 30]
  ])('should return false when time is outside normal start and end', (hour, minute) => {
    expect(isWithinTime('06:00', '07:00', getTime(hour, minute))).toBe(false);
  });

  it('should return true when time is within start and end, with offset', () => {
    expect(isWithinTime('23:00', '06:00 + 1d', getTime(23, 30))).toBe(true);
  });

  it('should return false when sun time is before start time', () => {
    getSunriseAndSunset.mockImplementation(() => ({ sunrise: getTime(5, 30) }));

    expect(isWithinTime('06:00', 'sunrise', getTime(6, 30))).toBe(false);
  });

  it('should return true when sun time is after start time', () => {
    getSunriseAndSunset.mockImplementation(() => ({ sunrise: getTime(7, 30) }));

    expect(isWithinTime('06:00', 'sunrise', getTime(6, 30))).toBe(true);
  });
});

describe('normalizeTime', () => {
  // Regression coverage for a bug where normalizeTime('17:00', date) used dayjs' hour()/minute()
  // setters, which don't recompute the Europe/London UTC offset for the resulting wall-clock
  // time - only for the offset already baked into `date`. Normalizing "17:00" against a `date`
  // on the opposite side of a DST transition from 17:00 itself silently produced a result an
  // hour off from the real local 17:00.
  it.each([
    ['BST starts (GMT date, BST target)', '2026-03-29T00:00:00Z', '+01:00'],
    ['BST ends (BST date, GMT target)', '2026-10-25T00:00:00Z', '+00:00'],
  ])('resolves "17:00" to the correct Europe/London offset across %s', (_, dateIso, expectedOffset) => {
    const result = normalizeTime('17:00', new Date(dateIso));

    expect(result.format('HH:mmZ')).toBe(`17:00${expectedOffset}`);
  });
});
