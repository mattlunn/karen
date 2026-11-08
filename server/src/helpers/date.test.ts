import { isInDailyWindow } from './date';

describe('isInDailyWindow', () => {
  const morning = { from: '04:00', to: '07:00' };

  it('includes the start of the window and excludes its end', () => {
    expect(isInDailyWindow(morning, new Date('2026-11-09T04:00:00Z'))).toBe(true);
    expect(isInDailyWindow(morning, new Date('2026-11-09T06:30:00Z'))).toBe(true);
    expect(isInDailyWindow(morning, new Date('2026-11-09T07:00:00Z'))).toBe(false);
    expect(isInDailyWindow(morning, new Date('2026-11-09T03:30:00Z'))).toBe(false);
  });

  it('reads the window in London time', () => {
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
