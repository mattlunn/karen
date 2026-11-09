import { timeString } from './schema';

describe('timeString', () => {
  it.each([
    '00:00',
    '08:00',
    '9:30',
    '23:59',
    'sunrise',
    'sunset',
    'sunset - 30m',
    'sunrise + 1h30m',
    '00:00 + 1d',
    '07:00-15m'
  ])('accepts %s', (value) => {
    expect(timeString.safeParse(value).success).toBe(true);
  });

  it.each([
    '9.30',      // wrong separator; throws from inside dayjs when the automation fires
    '25:00',     // out of range; silently normalises to 01:00 the next day
    '12:60',
    'abc',
    '',
    'midday',
    '08:00 +',   // offset marker with nothing after it
    '08:00 + m'  // offset with no quantity
  ])('rejects %s', (value) => {
    expect(timeString.safeParse(value).success).toBe(false);
  });
});
