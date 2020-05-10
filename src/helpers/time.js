import getSunriseAndSunset from './sun';
import moment from 'moment';

// "from" or "to" can be;
// - "sunrise", "sunset"
// - "sunrise + 1h30m 27s"
// - "00:00"

function normalizeDuration(offset) {
  const duration = moment.duration();

  // period === ["1h", "30m"]
  for (const period of offset.match(/\d+ *[a-zA-Z]/g)) {
    // [num, amount] === ["1", "h"]
    const [, num, amount] = period.match(/(\d+)(\w+)/);

    duration.add(+num, amount);
  }

  return duration;
}

export function normalizeTime(time, date) {
  if (time.includes('sunrise') || time.includes('sunset')) {
    const sunEvents = getSunriseAndSunset(date);
    const [sunEvent, direction, offset] = time.split(/ *([+-]) */);
    const timeOfSunEvent = moment(sunEvents[sunEvent]);

    // offset === "1h30m"
    if (offset) {
      timeOfSunEvent[direction === '+' ? 'add' : 'subtract'](normalizeDuration(offset));
    }

    return timeOfSunEvent;
  } else {
    const [hour, minute] = time.split(':');
    const ret = moment(date);

    ret.set({
      hour,
      minute
    });

    return ret;
  }
}

// Has tests!
export function isWithinTime(start, end, date = Date.now()) {
  let normalizedStart = normalizeTime(start, date);
  let normalizedEnd = normalizeTime(end, date);

  if (normalizedEnd.isSameOrBefore(normalizedStart)) {
    if (normalizedEnd.isBefore(date)) {
      normalizedEnd = normalizeTime(end, moment(date).add(1, 'd'));
    } else if (normalizedStart.isAfter(date)) {
      normalizedStart = normalizeTime(start, moment(date).subtract(1, 'd'));
    }
  }

  return normalizedStart.isSameOrBefore(date) && normalizedEnd.isAfter(date);
}