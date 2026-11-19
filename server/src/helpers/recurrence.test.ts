import dayjs from '../dayjs';
import { DateOverride, getNextOccurrence, getNextOccurrenceWithOverrides, isOccurrenceDay, isOccurrenceDayWithOverrides, iterateOccurrencesWithOverrides, Occurrence } from './recurrence';

describe('getNextOccurrence', () => {
  it('returns the anchor when the anchor is in the future', () => {
    const next = getNextOccurrence('2026-06-01', 1, dayjs('2026-05-15'));
    expect(next.format('YYYY-MM-DD')).toBe('2026-06-01');
  });

  it('returns today when the anchor is today', () => {
    const next = getNextOccurrence('2026-05-15', 1, dayjs('2026-05-15T08:00:00'));
    expect(next.format('YYYY-MM-DD')).toBe('2026-05-15');
  });

  it('jumps one period forward for weekly when current period has passed', () => {
    // Anchor on a Wednesday; ask after the following Wednesday.
    const next = getNextOccurrence('2026-05-06', 1, dayjs('2026-05-07T08:00:00'));
    expect(next.format('YYYY-MM-DD')).toBe('2026-05-13');
  });

  it('jumps one period forward for biweekly', () => {
    // Anchor 2026-05-06 (Wed), biweekly. After 2026-05-07 → next is 2026-05-20.
    const next = getNextOccurrence('2026-05-06', 2, dayjs('2026-05-07T08:00:00'));
    expect(next.format('YYYY-MM-DD')).toBe('2026-05-20');
  });

  it('skips over multiple elapsed periods', () => {
    // Weekly schedule, ask 5 weeks after anchor.
    const next = getNextOccurrence('2026-01-07', 1, dayjs('2026-02-12T10:00:00'));
    // 2026-02-11 is 5 weeks after 2026-01-07; next occurrence after Feb 12 is Feb 18.
    expect(next.format('YYYY-MM-DD')).toBe('2026-02-18');
  });
});

describe('isOccurrenceDay', () => {
  it('matches the anchor itself', () => {
    expect(isOccurrenceDay('2026-05-06', 1, '2026-05-06')).toBe(true);
  });

  it('matches a weekly multiple of the anchor', () => {
    expect(isOccurrenceDay('2026-05-06', 1, '2026-05-13')).toBe(true);
    expect(isOccurrenceDay('2026-05-06', 1, '2026-05-20')).toBe(true);
  });

  it('rejects an in-between day for biweekly', () => {
    expect(isOccurrenceDay('2026-05-06', 2, '2026-05-13')).toBe(false);
    expect(isOccurrenceDay('2026-05-06', 2, '2026-05-20')).toBe(true);
  });

  it('rejects dates before the anchor', () => {
    expect(isOccurrenceDay('2026-05-06', 1, '2026-04-29')).toBe(false);
  });
});

// 2026-05-06 is a Wednesday; every other week.
const anchor = '2026-05-06';

describe('isOccurrenceDayWithOverrides', () => {
  const overrides: DateOverride[] = [
    { originalDate: '2026-05-20', newDate: '2026-05-21' },
    { originalDate: '2026-06-03', newDate: null }
  ];

  it('matches a regular occurrence', () => {
    expect(isOccurrenceDayWithOverrides(anchor, 2, overrides, '2026-06-17')).toBe(true);
  });

  it('matches the day an occurrence was moved to', () => {
    expect(isOccurrenceDayWithOverrides(anchor, 2, overrides, '2026-05-21')).toBe(true);
  });

  it('misses the day an occurrence was moved from', () => {
    expect(isOccurrenceDayWithOverrides(anchor, 2, overrides, '2026-05-20')).toBe(false);
  });

  it('misses a cancelled occurrence', () => {
    expect(isOccurrenceDayWithOverrides(anchor, 2, overrides, '2026-06-03')).toBe(false);
  });
});

describe('iterateOccurrencesWithOverrides', () => {
  const take = (overrides: DateOverride[], from: string, count: number): Occurrence[] => {
    const occurrences = iterateOccurrencesWithOverrides(anchor, 2, overrides, dayjs(from));

    return Array.from({ length: count }, () => occurrences.next().value);
  };

  it('yields regular occurrences from the given day, including it', () => {
    expect(take([], '2026-05-20', 2)).toEqual([
      { scheduledDate: '2026-05-20', date: '2026-05-20' },
      { scheduledDate: '2026-06-03', date: '2026-06-03' }
    ]);
  });

  it('yields overrides in the order they happen', () => {
    const overrides = [
      { originalDate: '2026-06-03', newDate: '2026-05-19' },
      { originalDate: '2026-05-20', newDate: null }
    ];

    expect(take(overrides, '2026-05-07', 3)).toEqual([
      { scheduledDate: '2026-06-03', date: '2026-05-19' },
      { scheduledDate: '2026-05-20', date: null },
      { scheduledDate: '2026-06-17', date: '2026-06-17' }
    ]);
  });

  it('yields an occurrence moved later even once its original day has passed', () => {
    expect(take([{ originalDate: '2026-05-20', newDate: '2026-05-22' }], '2026-05-21', 2)).toEqual([
      { scheduledDate: '2026-05-20', date: '2026-05-22' },
      { scheduledDate: '2026-06-03', date: '2026-06-03' }
    ]);
  });

  it('skips overrides that have passed', () => {
    expect(take([{ originalDate: '2026-05-06', newDate: '2026-05-07' }], '2026-05-08', 1)).toEqual([
      { scheduledDate: '2026-05-20', date: '2026-05-20' }
    ]);
  });

  it('keeps to the right day across a clock change', () => {
    // BST ends on 2026-10-25.
    expect(take([], '2026-10-01', 3).map((occurrence) => occurrence.date)).toEqual(['2026-10-07', '2026-10-21', '2026-11-04']);
  });
});

describe('getNextOccurrenceWithOverrides', () => {
  it('skips cancelled occurrences', () => {
    const overrides = [
      { originalDate: '2026-05-20', newDate: null },
      { originalDate: '2026-06-03', newDate: null }
    ];

    expect(getNextOccurrenceWithOverrides(anchor, 2, overrides, dayjs('2026-05-07'))).toEqual({ scheduledDate: '2026-06-17', date: '2026-06-17' });
  });

  it('returns a rescheduled occurrence with both dates', () => {
    expect(getNextOccurrenceWithOverrides(anchor, 2, [{ originalDate: '2026-05-20', newDate: '2026-05-21' }], dayjs('2026-05-07')))
      .toEqual({ scheduledDate: '2026-05-20', date: '2026-05-21' });
  });
});
