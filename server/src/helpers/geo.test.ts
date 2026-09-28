import { distanceInMetres } from './geo';

describe('distanceInMetres', () => {
  it('is zero for the same point', () => {
    const point = { latitude: 51.4231038, longitude: -0.1927476 };

    expect(distanceInMetres(point, point)).toBe(0);
  });

  it('measures one degree of latitude as roughly 111km', () => {
    const distance = distanceInMetres({ latitude: 51, longitude: 0 }, { latitude: 52, longitude: 0 });

    expect(distance).toBeGreaterThan(111000);
    expect(distance).toBeLessThan(111400);
  });

  it('is symmetric', () => {
    const a = { latitude: 51.4231038, longitude: -0.1927476 };
    const b = { latitude: 51.803944, longitude: -0.210894 };

    expect(distanceInMetres(a, b)).toBeCloseTo(distanceInMetres(b, a), 6);
    expect(distanceInMetres(a, b)).toBeGreaterThan(42000);
    expect(distanceInMetres(a, b)).toBeLessThan(43000);
  });
});
