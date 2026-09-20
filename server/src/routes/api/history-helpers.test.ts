import { instantsInRange, averageHistory, instantsToLineData } from './history-helpers';

const T0 = new Date('2026-01-01T00:00:00.000Z');

function at(minutes: number): Date {
  return new Date(T0.getTime() + minutes * 60_000);
}

function history(events: { start: Date; end: Date | null; value: number }[], since: Date, until: Date) {
  return {
    since: since.toISOString(),
    until: until.toISOString(),
    history: events.map((event) => ({
      start: event.start.toISOString(),
      end: event.end ? event.end.toISOString() : null,
      lastReported: (event.end ?? until).toISOString(),
      value: event.value
    }))
  };
}

describe('instantsInRange', () => {
  it('spaces instants at range / targetPoints when that is above the 60s floor', () => {
    const instants = instantsInRange(at(0), at(100), 10);

    expect(instants).toHaveLength(10);
    expect(instants[1]).toEqual(at(10).toISOString());
  });

  it('floors the step at 60s even when range / targetPoints would be smaller', () => {
    const since = at(0);
    const until = new Date(since.getTime() + 90_000);

    const instants = instantsInRange(since, until, 2);

    expect(instants).toEqual([since.toISOString(), new Date(since.getTime() + 60_000).toISOString()]);
  });

  it('stays bounded over a long range', () => {
    const since = at(0);
    const until = new Date(since.getTime() + 30 * 24 * 60 * 60 * 1000);

    const instants = instantsInRange(since, until, 400);

    expect(instants.length).toBeLessThanOrEqual(401);
  });
});

describe('averageHistory', () => {
  const since = at(0);
  const until = at(180);

  it('returns null for a bucket no event covers', () => {
    const h = history([
      { start: at(60), end: null, value: 10 }
    ], since, until);

    const instants = [at(0).toISOString(), at(30).toISOString(), at(60).toISOString()];

    expect(averageHistory(h, instants).slice(0, 2)).toEqual([null, null]);
  });

  it('returns the held value when one event spans the whole bucket', () => {
    const h = history([
      { start: at(0), end: at(60), value: 5 },
      { start: at(60), end: at(120), value: 10 }
    ], since, at(120));

    expect(averageHistory(h, [at(0).toISOString(), at(60).toISOString()])).toEqual([5, 10]);
  });

  it('blends the values covering a bucket in proportion to their duration', () => {
    const h = history([
      { start: at(0), end: at(60), value: 5 },
      { start: at(60), end: at(120), value: 10 }
    ], since, at(120));

    // The first bucket spans 30 minutes of 5 and 30 of 10.
    expect(averageHistory(h, [at(30).toISOString(), at(90).toISOString()])).toEqual([7.5, 10]);
  });

  it('time-weights a load that cycles faster than the grid', () => {
    // On for 15 of every 60 minutes, so a quarter of its 2000W draw.
    const h = history([
      { start: at(0), end: at(15), value: 2000 },
      { start: at(15), end: at(60), value: 0 },
      { start: at(60), end: at(75), value: 2000 },
      { start: at(75), end: at(120), value: 0 }
    ], since, until);

    expect(averageHistory(h, [at(0).toISOString(), at(60).toISOString()])).toEqual([500, 500]);
  });

  it('averages only the covered part of a partially-covered bucket', () => {
    const h = history([{ start: at(30), end: at(60), value: 10 }], since, until);

    expect(averageHistory(h, [at(0).toISOString()])).toEqual([10]);
  });

  it('carries an open-ended final event to the window end', () => {
    const h = history([
      { start: at(0), end: at(60), value: 5 },
      { start: at(60), end: null, value: 10 }
    ], since, until);

    expect(averageHistory(h, [at(60).toISOString(), at(120).toISOString()])).toEqual([10, 10]);
  });
});

describe('instantsToLineData', () => {
  it('emits exactly one event per instant, with no gaps', () => {
    const instants = [at(0).toISOString(), at(10).toISOString(), at(20).toISOString()];
    const since = at(0).toISOString();
    const until = at(30).toISOString();

    const result = instantsToLineData(instants, since, until, (_instant, index) => index);

    expect(result.history).toHaveLength(3);
    expect(result.history[0]).toEqual({ start: instants[0], end: instants[1], lastReported: instants[1], value: 0 });
    expect(result.history[1]).toEqual({ start: instants[1], end: instants[2], lastReported: instants[2], value: 1 });
    expect(result.history[2]).toEqual({ start: instants[2], end: until, lastReported: until, value: 2 });
  });
});
