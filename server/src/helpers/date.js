import dayjs from '../dayjs';

export function humanDate(date) {
  const now = dayjs();

  if (date.isSame(now, 'day')) {
    return 'today';
  } else if (date.isSame(dayjs(now).subtract(1, 'day'), 'day')) {
    return 'yesterday';
  } else if (date.isSame(dayjs(now).add(1, 'day'), 'day')) {
    return 'tomorrow';
  } else {
    return 'on ' + (
      date.diff(now, 'months')
        ? date.format('ddd Do MMM')
        : date.format('ddd Do')
    );
  }
}