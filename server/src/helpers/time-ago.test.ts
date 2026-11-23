import dayjs from '../dayjs';
import { formatTimeAgo } from './time-ago';

const now = dayjs.tz('2026-11-23T13:00:00', 'Europe/London');
const ago = (taken: string) => formatTimeAgo(dayjs.tz(taken, 'Europe/London'), now);

describe('formatTimeAgo', () => {
  it.each([
    ['2026-11-23T08:00:00', 'Today'],
    ['2026-11-22T23:59:00', 'Yesterday'],
    ['2026-11-21T17:19:00', '2 days ago'],
    ['2026-11-12T12:22:00', '11 days ago'],
    ['2026-11-09T12:00:00', '2 weeks ago'],
    ['2026-10-04T16:48:00', '7 weeks ago'],
    ['2026-09-28T12:00:00', '2 months ago'],
    ['2026-04-04T08:52:00', '7 months ago'],
    ['2025-11-23T09:00:00', 'A year ago'],
    ['2023-06-27T09:00:00', '3 years ago']
  ])('describes %s as "%s"', (taken, expected) => {
    expect(ago(taken)).toBe(expected);
  });
});
