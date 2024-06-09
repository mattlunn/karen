import moment from 'moment';

export function humanDate(date) {
  const now = moment();

  if (date.isSame(now, 'day')) {
    return 'today';
  } else if (date.isSame(moment(now).subtract(1, 'day'), 'day')) {
    return 'yesterday';
  } else if (date.isSame(moment(now).add(1, 'day'), 'day')) {
    return 'tomorrow';
  } else {
    return 'on ' + (
      date.diff(now, 'months')
        ? date.format('ddd Do MMM')
        : date.format('ddd Do')
    );
  }
}