import { isInDailyWindow, fitsInDailyWindow, timeOfDayOn } from './date';

describe('timeOfDayOn', () => {
  it('lands on that time of the same day, in local time', () => {
    expect(timeOfDayOn('16:00', new Date('2026-11-09T13:20:00Z'))).toEqual(new Date('2026-11-09T16:00:00Z'));
    expect(timeOfDayOn('16:00', new Date('2026-07-09T13:20:00Z'))).toEqual(new Date('2026-07-09T15:00:00Z'));
  });

  it('treats 24:00 as the following midnight', () => {
    expect(timeOfDayOn('24:00', new Date('2026-11-09T22:30:00Z'))).toEqual(new Date('2026-11-10T00:00:00Z'));
  });

  it('keeps the local time on the day the clocks change', () => {
    // 25 Oct 2026: BST until 01:00 GMT, so 16:00 local is 16:00Z.
    expect(timeOfDayOn('16:00', new Date('2026-10-25T12:00:00Z'))).toEqual(new Date('2026-10-25T16:00:00Z'));
  });
});

describe('isInDailyWindow', () => {
  const morning = { from: '04:00', to: '07:00' };

  it('includes the start of the window and excludes its end', () => {
    expect(isInDailyWindow(morning, new Date('2026-11-09T04:00:00Z'))).toBe(true);
    expect(isInDailyWindow(morning, new Date('2026-11-09T06:30:00Z'))).toBe(true);
    expect(isInDailyWindow(morning, new Date('2026-11-09T07:00:00Z'))).toBe(false);
    expect(isInDailyWindow(morning, new Date('2026-11-09T03:30:00Z'))).toBe(false);
  });

  it('reads the window in local time', () => {
    // 03:30Z is 04:30 BST.
    expect(isInDailyWindow(morning, new Date('2026-07-09T03:30:00Z'))).toBe(true);
    expect(isInDailyWindow(morning, new Date('2026-07-09T06:00:00Z'))).toBe(false);
  });

  it('runs a window ending at 24:00 up to midnight', () => {
    const late = { from: '22:00', to: '24:00' };

    expect(isInDailyWindow(late, new Date('2026-11-09T23:30:00Z'))).toBe(true);
    expect(isInDailyWindow(late, new Date('2026-11-10T00:00:00Z'))).toBe(false);
  });
});

describe('fitsInDailyWindow', () => {
  const morning = { from: '04:15', to: '07:00' };
  const slot = (iso: string) => [new Date(iso), new Date(new Date(iso).getTime() + 30 * 60_000)] as const;

  it('takes a slot wholly inside the window', () => {
    expect(fitsInDailyWindow(morning, ...slot('2026-11-09T06:30:00Z'))).toBe(true);
  });

  it('drops a slot the window only partly covers', () => {
    expect(fitsInDailyWindow(morning, ...slot('2026-11-09T04:00:00Z'))).toBe(false);
    expect(fitsInDailyWindow({ from: '04:00', to: '06:45' }, ...slot('2026-11-09T06:30:00Z'))).toBe(false);
  });
});
