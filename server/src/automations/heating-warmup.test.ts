import { resolveOffsetWrite, OffsetWrite } from './heating-warmup';

const preheat = { key: '2026-11-09 13:00', end: new Date('2026-11-09T16:00:00Z'), offset: 1 };
const peak = { key: '2026-11-09 16:00', end: new Date('2026-11-09T19:00:00Z'), offset: -0.5 };

function resolve(overrides: Partial<Parameters<typeof resolveOffsetWrite>[0]>) {
  return resolveOffsetWrite({
    window: preheat,
    base: 20,
    current: 20,
    untouchedTargets: [20, 20, 18],
    previous: undefined,
    isSomeoneHome: true,
    ...overrides,
  });
}

describe('resolveOffsetWrite', () => {
  it('offsets an untouched room at the start of a window', () => {
    expect(resolve({})).toEqual({ write: 21, record: { windowKey: preheat.key, value: 21 } });
  });

  it('leaves a room alone that someone at home has changed by hand', () => {
    expect(resolve({ current: 22 })).toEqual({ write: null, record: { windowKey: preheat.key, value: null } });
  });

  it('counts the away setback as untouched', () => {
    expect(resolve({ current: 18 }).write).toBe(21);
  });

  it('offsets regardless of the current target when nobody is home to have changed it', () => {
    expect(resolve({ current: 16, isSomeoneHome: false }).write).toBe(21);
  });

  it('writes nothing more while the room still holds its offset target', () => {
    const previous: OffsetWrite = { windowKey: preheat.key, value: 21 };

    expect(resolve({ current: 21, previous })).toEqual({ write: null, record: previous });
  });

  it('follows the base when the schedule moves mid-window', () => {
    const previous: OffsetWrite = { windowKey: preheat.key, value: 21 };

    expect(resolve({ base: 19, current: 21, previous }).write).toBe(20);
  });

  it('stops for the rest of the window once the room is changed by hand', () => {
    const changed = resolve({ current: 22, previous: { windowKey: preheat.key, value: 21 } });

    expect(changed.write).toBeNull();
    expect(resolve({ current: 21, previous: changed.record }).write).toBeNull();
  });

  it('hands straight over to the next window while Tado still shows its own offset', () => {
    const fromPreheat: OffsetWrite = { windowKey: preheat.key, value: 21 };

    expect(resolve({ window: peak, current: 21, previous: fromPreheat })).toEqual({ write: 19.5, record: { windowKey: peak.key, value: 19.5 } });
  });

  it('keeps leaving a room alone into the next window while its hand-set target stands', () => {
    const left: OffsetWrite = { windowKey: preheat.key, value: null };

    expect(resolve({ window: peak, current: 22, previous: left }).write).toBeNull();
  });
});
