import getSunriseAndSunset from './sun';
import dayjs from '../dayjs';

function normalizeOffset(offset) {
  let totalMs = 0;

  // period === ["1h", "30m"]
  for (const period of offset.match(/\d+ *[a-zA-Z]/g)) {
    // [num, amount] === ["1", "h"]
    const [, num, amount] = period.match(/(\d+)(\w+)/);

    totalMs += dayjs.duration(+num, amount).asMilliseconds();
  }

  return totalMs;
}

function normalizeBase(base, date) {
  if (base === 'sunrise' || base === 'sunset') {
    return dayjs(getSunriseAndSunset(date)[base]);
  } else {
    const [hour, minute] = base.split(':');

    // dayjs' hour()/minute() setters operate on the fixed UTC offset already baked into `date`
    // (from converting it to Europe/London), rather than re-deriving the correct offset for the
    // resulting wall-clock time. That's fine when `date` and the target time share a DST state,
    // but silently produces a result an hour off when they fall on opposite sides of a
    // transition (e.g. normalizing "17:00" against a date at UTC midnight, the day BST starts).
    // Round-trip through a plain date/time string via dayjs.tz() instead, which does perform
    // that offset lookup correctly for the resulting local time.
    const dateStr = dayjs(date).format('YYYY-MM-DD');

    return dayjs.tz(`${dateStr} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`, 'Europe/London');
  }
}

export function normalizeTime(time, date = new Date()) {
  const [base, direction, offset] = time.split(/ *([+-]) */);
  let normalizedBase = normalizeBase(base, date);

  if (offset) {
    const offsetMs = normalizeOffset(offset);
    normalizedBase = direction === '+'
      ? normalizedBase.add(offsetMs, 'millisecond')
      : normalizedBase.subtract(offsetMs, 'millisecond');
  }

  return normalizedBase;
}

// Has tests!
export function isWithinTime(start, end, date = new Date()) {
  let normalizedStart = normalizeTime(start, date);
  let normalizedEnd = normalizeTime(end, date);

  if (normalizedStart.isAfter(date) && normalizedEnd.date() - normalizedStart.date() === 1) {
    normalizedStart = normalizedStart.subtract(1, 'd');
    normalizedEnd = normalizedEnd.subtract(1, 'd');
  }

  return normalizedStart.isSameOrBefore(date) && normalizedEnd.isAfter(date);
}
