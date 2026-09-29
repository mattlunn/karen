import { decide, PowerReading } from './appliance-run-transition';

const base = new Date('2026-01-01T00:00:00.000Z');

function at(minutesFromBase: number): Date {
  return new Date(base.getTime() + minutesFromBase * 60_000);
}

function readings(entries: [number, number][]): PowerReading[] {
  return entries.map(([minute, value]) => ({ start: at(minute), value }));
}

describe('decide', () => {
  describe('when idle', () => {
    it('starts a run once power has been above the threshold for the whole start window', () => {
      expect(decide(readings([[-30, 3], [2, 45], [4, 30]]), null, at(8))).toEqual({ isRunning: true, at: at(2) });
    });

    it('starts the run from the reading in force at the window start, even if it began earlier', () => {
      expect(decide(readings([[-30, 3], [-10, 45], [4, 30]]), null, at(8))).toEqual({ isRunning: true, at: at(-10) });
    });

    it('does nothing while power has not yet been above the threshold for the whole window', () => {
      expect(decide(readings([[-30, 3], [5, 45]]), null, at(8))).toBeNull();
    });

    it('ignores a brief blip that dips back below the threshold', () => {
      expect(decide(readings([[-30, 3], [2, 60], [4, 4], [5, 60]]), null, at(8))).toBeNull();
    });

    it('does nothing without a reading in force at the window start', () => {
      expect(decide(readings([[5, 45]]), null, at(8))).toBeNull();
    });
  });

  describe('when running', () => {
    const runStartedAt = at(-120);

    it('ends the run once power has been below the threshold for the whole end window', () => {
      expect(decide(readings([[-60, 40], [-12, 4], [-3, 0]]), runStartedAt, at(0))).toEqual({ isRunning: false, at: at(-12) });
    });

    it('keeps running through a dip shorter than the end window', () => {
      expect(decide(readings([[-60, 40], [-8, 6], [-2, 35]]), runStartedAt, at(0))).toBeNull();
    });

    it('does not end the run before it started', () => {
      expect(decide(readings([[-200, 4]]), runStartedAt, at(0))).toEqual({ isRunning: false, at: runStartedAt });
    });
  });
});
