import { roundTo } from './number';

describe('roundTo', () => {
  it('rounds to whole numbers', () => {
    expect(roundTo(0.3, 0)).toBe(0);
    expect(roundTo(0.5, 0)).toBe(1);
    expect(roundTo(413.7, 0)).toBe(414);
    expect(roundTo(-0.4, 0)).toBe(-0);
  });

  it('rounds to a given number of decimal places', () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(1.235, 2)).toBe(1.24);
    expect(roundTo(2.5, 1)).toBe(2.5);
  });

  it('leaves an already-rounded value untouched', () => {
    expect(roundTo(7, 0)).toBe(7);
    expect(roundTo(7.25, 2)).toBe(7.25);
  });
});
