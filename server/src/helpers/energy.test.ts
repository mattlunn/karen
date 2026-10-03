import { calculateWattHours } from './energy';
import type { NumericEvent } from '../models';

const T0 = new Date('2026-01-01T00:00:00Z');

function event(startSeconds: number, endSeconds: number, value: number): NumericEvent {
  return {
    start: new Date(T0.getTime() + startSeconds * 1000),
    end: new Date(T0.getTime() + endSeconds * 1000),
    value,
  } as NumericEvent;
}

describe('calculateWattHours', () => {
  it('integrates whole-minute events', () => {
    expect(calculateWattHours([event(0, 3600, 1000), event(3600, 5400, 500)])).toBe(1250);
  });

  it('counts events shorter than a minute', () => {
    const events = Array.from({ length: 3600 }, (_, i) => event(i, i + 1, 2000));

    expect(calculateWattHours(events)).toBe(2000);
  });

  it('counts the part-minute remainder of longer events', () => {
    expect(calculateWattHours([event(0, 90, 2400)])).toBe(60);
  });
});
