import getSunriseAndSunset from './sun';
import moment from 'moment';

function normalizeOffset(offset) {
  const duration = moment.duration();

  // period === ["1h", "30m"]
  for (const period of offset.match(/\d+ *[a-zA-Z]/g)) {
    // [num, amount] === ["1", "h"]
    const [, num, amount] = period.match(/(\d+)(\w+)/);

    duration.add(+num, amount);
  }

  return duration;
}

function normalizeBase(base, date) {
  if (base === 'sunrise' || base === 'sunset') {
    return moment(getSunriseAndSunset(date)[base]);
  } else {
    const [hour, minute] = base.split(':');
    const ret = moment(date);

    ret.set({
      hour,
      minute
    });

    return ret;
  }
}

function normalizeTime(time, date) {
  const [base, direction, offset] = time.split(/ *([+-]) */);
  const normalizedBase = normalizeBase(base, date);

  if (offset) {
    normalizedBase[direction === '+' ? 'add' : 'subtract'](normalizeOffset(offset));
  }

  return normalizedBase;
}

// Has tests!
export function isWithinTime(start, end, date = Date.now()) {
  const normalizedStart = normalizeTime(start, date);
  const normalizedEnd = normalizeTime(end, date);

  if (normalizedStart.isAfter(date) && normalizedEnd.date() - normalizedStart.date() === 1) {
    normalizedStart.subtract(1, 'd');
    normalizedEnd.subtract(1, 'd');
  }

  return normalizedStart.isSameOrBefore(date) && normalizedEnd.isAfter(date);
}