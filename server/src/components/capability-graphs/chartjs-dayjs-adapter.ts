import { _adapters, TimeUnit } from 'chart.js';
import dayjs, { Dayjs, ManipulateType, OpUnitType, QUnitType } from '../../dayjs';

const WALL_CLOCK_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSS';
const SUB_DAY_UNITS: (TimeUnit | 'isoWeek')[] = ['millisecond', 'second', 'minute', 'hour'];

// dayjs's timezone plugin does its arithmetic on the underlying instant (and startOf/endOf in the
// host's zone), so across a DST change a "day" is 24 hours rather than midnight to midnight. Calendar
// units are instead computed on a UTC copy of the London wall clock; sub-day units can stay on the
// instant, as London's offsets are whole hours.
function inLondon(time: number, unit: TimeUnit | 'isoWeek', fn: (time: Dayjs) => Dayjs): number {
  if (SUB_DAY_UNITS.includes(unit)) {
    return fn(dayjs.utc(time)).valueOf();
  }

  const wallClock = dayjs.utc(dayjs(time).format(WALL_CLOCK_FORMAT));

  return dayjs.tz(fn(wallClock).format(WALL_CLOCK_FORMAT), 'Europe/London').valueOf();
}

_adapters._date.override({
  formats: () => ({
    datetime: 'MMM D, YYYY, h:mm:ss a',
    millisecond: 'h:mm:ss.SSS a',
    second: 'h:mm:ss a',
    minute: 'h:mm a',
    hour: 'hA',
    day: 'MMM D',
    week: 'MMM D',
    month: 'MMM YYYY',
    quarter: '[Q]Q - YYYY',
    year: 'YYYY'
  }),

  parse(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = dayjs(value as string | number | Date);

    return parsed.isValid() ? parsed.valueOf() : null;
  },

  format: (time, format) => dayjs(time).format(format),
  add: (time, amount, unit) => inLondon(time, unit, (d) => d.add(amount, unit as ManipulateType)),
  diff: (max, min, unit) => dayjs(max).diff(dayjs(min), unit as QUnitType),
  startOf: (time, unit) => inLondon(time, unit, (d) => d.startOf(unit as OpUnitType)),
  endOf: (time, unit) => inLondon(time, unit, (d) => d.endOf(unit as OpUnitType))
});
