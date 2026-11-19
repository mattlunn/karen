jest.mock('../config', () => ({}));

import dayjs from '../dayjs';
import { findActiveSilencingWindow, getSilencingWindowEndsAt, getUpcomingSilencingWindowOccurrences, SilencingWindow, SilencingWindowOccurrence } from './silencing-window';

// 2026-05-06 is a Wednesday.
const cleaner: SilencingWindow = {
  name: 'Cleaner',
  anchor_date: '2026-05-06',
  interval_weeks: 2,
  start: '08:00',
  end: '12:00',
  overrides: []
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
      end: '15:00',
      overrides: []
    };

    expect(findActiveSilencingWindow([cleaner, gardener], at('2026-05-07T14:00:00'))).toBe(gardener);
  });

  describe('with an occurrence moved to another day', () => {
    const moved: SilencingWindow = {
      ...cleaner,
      overrides: [{ original_date: '2026-05-20', new_date: '2026-05-21' }]
    };

    it('misses the original day', () => {
      expect(findActiveSilencingWindow([moved], at('2026-05-20T09:00:00'))).toBeUndefined();
    });

    it('matches the new day within the time window', () => {
      expect(findActiveSilencingWindow([moved], at('2026-05-21T09:00:00'))).toBe(moved);
    });

    it('misses the new day outside the time window', () => {
      expect(findActiveSilencingWindow([moved], at('2026-05-21T12:30:00'))).toBeUndefined();
    });

    it('leaves the other occurrences alone', () => {
      expect(findActiveSilencingWindow([moved], at('2026-06-03T09:00:00'))).toBe(moved);
    });
  });

  describe('with an occurrence cancelled', () => {
    const cancelled: SilencingWindow = {
      ...cleaner,
      overrides: [{ original_date: '2026-05-20', new_date: null }]
    };

    it('misses the cancelled day', () => {
      expect(findActiveSilencingWindow([cancelled], at('2026-05-20T09:00:00'))).toBeUndefined();
    });

    it('leaves the other occurrences alone', () => {
      expect(findActiveSilencingWindow([cancelled], at('2026-06-03T09:00:00'))).toBe(cancelled);
    });
  });

  it('returns undefined when no windows are configured', () => {
    expect(findActiveSilencingWindow([], at('2026-05-06T09:00:00'))).toBeUndefined();
  });
});

describe('getSilencingWindowEndsAt', () => {
  it('resolves the window end to a concrete instant on the day of the motion', () => {
    const endsAt = getSilencingWindowEndsAt(cleaner, at('2026-05-06T09:00:00'));

    expect(dayjs(endsAt).tz('Europe/London').format('YYYY-MM-DD HH:mm')).toBe('2026-05-06 12:00');
  });
});

describe('getUpcomingSilencingWindowOccurrences', () => {
  const summarise = (occurrences: SilencingWindowOccurrence[]) => occurrences.map((occurrence) => ({
    name: occurrence.window.name,
    status: occurrence.status,
    scheduled: occurrence.scheduledStart.format('YYYY-MM-DD HH:mm') + '-' + occurrence.scheduledEnd.format('HH:mm'),
    actual: occurrence.start && occurrence.start.format('YYYY-MM-DD HH:mm') + '-' + occurrence.end!.format('HH:mm')
  }));

  it('returns the next regular occurrence', () => {
    expect(summarise(getUpcomingSilencingWindowOccurrences([cleaner], at('2026-05-07T09:00:00')))).toEqual([
      { name: 'Cleaner', status: 'SCHEDULED', scheduled: '2026-05-20 08:00-12:00', actual: '2026-05-20 08:00-12:00' }
    ]);
  });

  it('returns an occurrence that is in progress', () => {
    expect(summarise(getUpcomingSilencingWindowOccurrences([cleaner], at('2026-05-20T11:00:00')))).toEqual([
      { name: 'Cleaner', status: 'SCHEDULED', scheduled: '2026-05-20 08:00-12:00', actual: '2026-05-20 08:00-12:00' }
    ]);
  });

  it('skips an occurrence that has finished today', () => {
    expect(summarise(getUpcomingSilencingWindowOccurrences([cleaner], at('2026-05-20T12:30:00')))).toEqual([
      { name: 'Cleaner', status: 'SCHEDULED', scheduled: '2026-06-03 08:00-12:00', actual: '2026-06-03 08:00-12:00' }
    ]);
  });

  it('returns a rescheduled occurrence with its new slot', () => {
    const moved = { ...cleaner, overrides: [{ original_date: '2026-05-20', new_date: '2026-05-21' }] };

    expect(summarise(getUpcomingSilencingWindowOccurrences([moved], at('2026-05-07T09:00:00')))).toEqual([
      { name: 'Cleaner', status: 'RESCHEDULED', scheduled: '2026-05-20 08:00-12:00', actual: '2026-05-21 08:00-12:00' }
    ]);
  });

  it('still returns an occurrence moved later once its original day has passed', () => {
    const moved = { ...cleaner, overrides: [{ original_date: '2026-05-20', new_date: '2026-05-22' }] };

    expect(summarise(getUpcomingSilencingWindowOccurrences([moved], at('2026-05-21T09:00:00')))).toEqual([
      { name: 'Cleaner', status: 'RESCHEDULED', scheduled: '2026-05-20 08:00-12:00', actual: '2026-05-22 08:00-12:00' }
    ]);
  });

  it('orders an occurrence moved earlier by when it now happens', () => {
    const moved = { ...cleaner, overrides: [{ original_date: '2026-06-03', new_date: '2026-05-19' }] };

    expect(summarise(getUpcomingSilencingWindowOccurrences([moved], at('2026-05-07T09:00:00')))).toEqual([
      { name: 'Cleaner', status: 'RESCHEDULED', scheduled: '2026-06-03 08:00-12:00', actual: '2026-05-19 08:00-12:00' }
    ]);
  });

  it('returns cancelled occurrences followed by the next one that will happen', () => {
    const cancelled = {
      ...cleaner,
      overrides: [
        { original_date: '2026-05-20', new_date: null },
        { original_date: '2026-06-03', new_date: null }
      ]
    };

    expect(summarise(getUpcomingSilencingWindowOccurrences([cancelled], at('2026-05-07T09:00:00')))).toEqual([
      { name: 'Cleaner', status: 'CANCELLED', scheduled: '2026-05-20 08:00-12:00', actual: null },
      { name: 'Cleaner', status: 'CANCELLED', scheduled: '2026-06-03 08:00-12:00', actual: null },
      { name: 'Cleaner', status: 'SCHEDULED', scheduled: '2026-06-17 08:00-12:00', actual: '2026-06-17 08:00-12:00' }
    ]);
  });

  it('ignores overrides that have passed', () => {
    const old = { ...cleaner, overrides: [{ original_date: '2026-05-06', new_date: null }] };

    expect(summarise(getUpcomingSilencingWindowOccurrences([old], at('2026-05-07T09:00:00')))).toEqual([
      { name: 'Cleaner', status: 'SCHEDULED', scheduled: '2026-05-20 08:00-12:00', actual: '2026-05-20 08:00-12:00' }
    ]);
  });

  it('returns the soonest occurrence across several windows', () => {
    const gardener: SilencingWindow = {
      name: 'Gardener',
      anchor_date: '2026-05-07', // Thursday
      interval_weeks: 4,
      start: '13:00',
      end: '15:00',
      overrides: []
    };

    expect(summarise(getUpcomingSilencingWindowOccurrences([cleaner, gardener], at('2026-05-07T09:00:00')))).toEqual([
      { name: 'Gardener', status: 'SCHEDULED', scheduled: '2026-05-07 13:00-15:00', actual: '2026-05-07 13:00-15:00' }
    ]);
  });

  it('resolves slots on the far side of a clock change', () => {
    // BST ends on 2026-10-25.
    const autumn = { ...cleaner, anchor_date: '2026-10-21' };
    const [next] = getUpcomingSilencingWindowOccurrences([autumn], at('2026-10-22T09:00:00'));

    expect(next.start!.toISOString()).toBe('2026-11-04T08:00:00.000Z');
  });

  it('returns nothing when no windows are configured', () => {
    expect(getUpcomingSilencingWindowOccurrences([], at('2026-05-07T09:00:00'))).toEqual([]);
  });
});
