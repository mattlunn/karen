import moment from 'moment';

export function humanDate(date) {
  const now = moment();

  switch (date.diff(now, 'days')) {
    case 0:
      return 'today';
    case -1:
      return 'yesterday';
    case 1:
      return 'tomorrow';
    default:
      return 'on ' + (
        date.diff(now, 'months')
          ? date.format('ddd Do MMM')
          : date.format('ddd Do')
      );
  }
}