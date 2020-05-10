import { isWithinTime } from './time';
import moment from 'moment-timezone';

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

  it('should return false when time is before normal start and end', () => {
    expect(isWithinTime('01:00', '02:00', getTime(0, 30))).toBe(false);
  });

  it('should return false when time is after normal start and end', () => {
    expect(isWithinTime('01:00', '02:00', getTime(2, 30))).toBe(false);
  });

  it.each([
    [1, 30],
    [23, 30]
  ])('should return true when time is within start and end which crosses multiple days', (hour, minute) => {
    expect(isWithinTime('22:00', '02:00', getTime(hour, minute))).toBe(true);
  });

  it.each([
    [4, 30],
    [20, 30]
  ])('should return false when time is outside start and end which crosses multiple days', () => {
    expect(isWithinTime('22:00', '02:00', getTime(4, 30))).toBe(false);
  });
});