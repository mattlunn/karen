jest.mock('../config', () => ({}), { virtual: true });

import dayjs from '../dayjs';
import { findActiveSilencingWindow, SilencingWindow } from './silencing-window';

// 2026-05-06 is a Wednesday.
const cleaner: SilencingWindow = {
  name: 'Cleaner',
  anchor_date: '2026-05-06',
  interval_weeks: 2,
  start: '08:00',
  end: '12:00'
};

// The app runs in Europe/London, and windows are matched against wall-clock time, so build
// the test instants in that timezone to keep them independent of the machine's timezone.
const at = (iso: string) => dayjs.tz(iso, 'Europe/London').toDate();

describe('findActiveSilencingWindow', () => {
  it('matches on the anchor day within the time window', () => {
    expect(findActiveSilencingWindow([cleaner], at('2026-05-06T09:00:00'))).toBe(cleaner);
  });

  it('matches a later occurrence of the biweekly schedule', () => {
    expect(findActiveSilencingWindow([cleaner], at('2026-05-20T09:00:00'))).toBe(cleaner);
  });

  it('misses an off-week Wednesday', () => {
    expect(findActiveSilencingWindow([cleaner], at('2026-05-13T09:00:00'))).toBeUndefined();
  });

  it('misses before the window starts', () => {
    expect(findActiveSilencingWindow([cleaner], at('2026-05-06T07:30:00'))).toBeUndefined();
  });

  it('misses after the window ends', () => {
    expect(findActiveSilencingWindow([cleaner], at('2026-05-06T12:30:00'))).toBeUndefined();
  });

  it('returns the matching window when several are configured', () => {
    const gardener: SilencingWindow = {
      name: 'Gardener',
      anchor_date: '2026-05-07', // Thursday
      interval_weeks: 1,
      start: '13:00',
      end: '15:00'
    };

    expect(findActiveSilencingWindow([cleaner, gardener], at('2026-05-07T14:00:00'))).toBe(gardener);
  });

  it('returns undefined when no windows are configured', () => {
    expect(findActiveSilencingWindow([], at('2026-05-06T09:00:00'))).toBeUndefined();
  });
});
