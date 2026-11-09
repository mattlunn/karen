import { timeString, timeOfDay, dailyWindow } from './schema';

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

describe('timeOfDay', () => {
  it.each(['00:00', '04:15', '13:00', '23:59', '24:00'])('accepts %s', (value) => {
    expect(timeOfDay.safeParse(value).success).toBe(true);
  });

  it.each(['4:00', '4.00', '24:30', '25:00', '12:60', 'sunset'])('rejects %s', (value) => {
    expect(timeOfDay.safeParse(value).success).toBe(false);
  });
});

describe('dailyWindow', () => {
  it('accepts a window that starts before it ends', () => {
    expect(dailyWindow.safeParse({ from: '22:00', to: '24:00' }).success).toBe(true);
  });

  it.each([
    { from: '07:00', to: '04:00' },
    { from: '22:00', to: '02:00' },
    { from: '13:00', to: '13:00' },
  ])('rejects $from-$to', (window) => {
    expect(dailyWindow.safeParse(window).success).toBe(false);
  });
});
