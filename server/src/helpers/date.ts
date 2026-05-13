import dayjs, { Dayjs } from '../dayjs';

export function humanDate(date: Dayjs): string {
  const now = dayjs();

  if (date.isSame(now, 'day')) {
    return 'today';
  } else if (date.isSame(dayjs(now).subtract(1, 'day'), 'day')) {
    return 'yesterday';
  } else if (date.isSame(dayjs(now).add(1, 'day'), 'day')) {
    return 'tomorrow';
  } else {
    return 'on ' + (
      date.isSame(now, 'month')
        ? date.format('ddd Do')
        : date.format('ddd Do MMM')
    );
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    const rounded = Math.max(1, Math.round(seconds));
    return `${rounded} second${rounded === 1 ? '' : 's'}`;
  }

  const totalMinutes = Math.round(seconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hoursPart = `${hours} hour${hours === 1 ? '' : 's'}`;

  if (minutes === 0) {
    return hoursPart;
  }

  return `${hoursPart} ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
