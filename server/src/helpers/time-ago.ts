import type { Dayjs } from '../dayjs';

export function formatTimeAgo(then: Dayjs, now: Dayjs): string {
  const days = now.startOf('day').diff(then.startOf('day'), 'day');

  if (days <= 0) {
    return 'Today';
  }

  if (days === 1) {
    return 'Yesterday';
  }

  if (days < 14) {
    return `${days} days ago`;
  }

  if (days < 56) {
    return `${Math.floor(days / 7)} weeks ago`;
  }

  const months = now.diff(then, 'month');

  if (months < 12) {
    return `${Math.max(months, 2)} months ago`;
  }

  const years = now.diff(then, 'year');

  return years === 1 ? 'A year ago' : `${years} years ago`;
}
