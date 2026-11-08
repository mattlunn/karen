import { timeString, halfHourTimeOfDay } from './schema';

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

describe('halfHourTimeOfDay', () => {
  it.each(['00:00', '04:30', '13:00', '23:30', '24:00'])('accepts %s', (value) => {
    expect(halfHourTimeOfDay.safeParse(value).success).toBe(true);
  });

  it.each(['4:00', '13:15', '24:30', '25:00', 'sunset'])('rejects %s', (value) => {
    expect(halfHourTimeOfDay.safeParse(value).success).toBe(false);
  });
});
