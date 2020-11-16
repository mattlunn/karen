import getSunriseAndSunset from './sun';

jest.mock('../config', () => ({
  location: {
    latitude: 51.50101,
    longitude: -0.14159
  }
}), { virtual: true });

describe('getSunriseAndSunset', () => {
  it('should return sunset and sunrise of the current day', () => {
    const { sunset, sunrise } = getSunriseAndSunset(new Date(2020, 11, 15, 0, 1, 0));

    expect(sunset.toISOString()).toBe('2020-12-15T15:53:03.510Z');
    expect(sunrise.toISOString()).toBe('2020-12-15T08:01:23.478Z');
  });
});