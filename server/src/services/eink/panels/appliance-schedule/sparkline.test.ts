import { PriceSlot } from '../../../../helpers/prices';
import { scaleSparkline } from './sparkline';

const NOW = new Date('2026-01-01T00:00:00Z');

function at(hours: number): Date {
  return new Date(NOW.getTime() + hours * 60 * 60 * 1000);
}

function run(fromHour: number, toHour: number, pence: number): PriceSlot[] {
  const slots: PriceSlot[] = [];

  for (let h = fromHour; h < toHour; h += 0.5) {
    slots.push({ start: at(h), end: at(h + 0.5), pence });
  }

  return slots;
}

describe('scaleSparkline', () => {
  it('returns nothing when no slots fall within the window', () => {
    expect(scaleSparkline([], NOW, 12, 200, 40)).toEqual({ points: [], zeroY: null });
  });

  it('places the first point at x = 0, since the window starts at now', () => {
    const { points } = scaleSparkline(run(0, 12, 10), NOW, 12, 200, 40);

    expect(points[0].x).toBe(0);
  });

  it('drops slots before now and past the window', () => {
    const slots = [...run(-2, 0, 5), ...run(0, 12, 10), ...run(12, 14, 5)];
    const { points } = scaleSparkline(slots, NOW, 12, 200, 40);

    expect(points).toHaveLength(24); // 12h of half-hour slots
  });

  it('min-max scales to the window\'s own range, not a fixed axis', () => {
    const slots = [{ start: at(0), end: at(0.5), pence: 0 }, { start: at(0.5), end: at(1), pence: 20 }];
    const { points } = scaleSparkline(slots, NOW, 12, 200, 40);

    expect(points[0].y).toBe(40); // cheapest -> bottom
    expect(points[1].y).toBe(0); // priciest -> top
  });

  it('centers a flat price series rather than dividing by zero', () => {
    const { points } = scaleSparkline(run(0, 2, 10), NOW, 12, 200, 40);

    expect(points.every(p => p.y === 20)).toBe(true);
  });

  it('marks the zero line only when the window actually crosses zero', () => {
    const crossing = scaleSparkline([{ start: at(0), end: at(0.5), pence: -5 }, { start: at(0.5), end: at(1), pence: 5 }], NOW, 12, 200, 40);
    const allPositive = scaleSparkline(run(0, 2, 10), NOW, 12, 200, 40);
    const allNegative = scaleSparkline(run(0, 2, -10), NOW, 12, 200, 40);

    expect(crossing.zeroY).not.toBeNull();
    expect(allPositive.zeroY).toBeNull();
    expect(allNegative.zeroY).toBeNull();
  });
});
