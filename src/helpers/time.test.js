jest.mock('../config', () => ({}), { virtual: true });

import { isWithinTime } from './time';
import getSunriseAndSunset from './sun';
import moment from 'moment-timezone';

jest.mock('./sun');

function getTime(hour, minute) {
  return moment().startOf('day').set({
    hour,
    minute
  });
}

describe('isWithinTime', () => {
  it('should return true when time is within normal start and end', () => {
    expect(isWithinTime('01:00', '02:00', getTime(1, 30))).toBe(true);
  });

  it.each([
    [0, 30],
    [2, 30]
  ])('should return false when time is outside normal start and end', (hour, minute) => {
    expect(isWithinTime('01:00', '02:00', getTime(hour, minute))).toBe(false);
  });

  it.each([
    [23, 30],
    [1, 30]
  ])('should return true when time is within start and end, with offset', (hour, minute) => {
    expect(isWithinTime('23:00', '06:00 + 1d', getTime(hour, minute))).toBe(true);
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