import dayjs from '../dayjs';
import { getNextOccurrence, isOccurrenceDay } from './recurrence';

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
