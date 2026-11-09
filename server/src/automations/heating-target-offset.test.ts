import { resolveOffsetTarget } from './heating-target-offset';

function resolve(overrides: Partial<Parameters<typeof resolveOffsetTarget>[0]>) {
  return resolveOffsetTarget({
    scheduled: 20,
    base: 20,
    setback: 18,
    offset: 1,
    configuredOffsets: [1, -0.5],
    current: 20,
    ...overrides,
  });
}

describe('resolveOffsetTarget', () => {
  it('offsets a room on its schedule', () => {
    expect(resolve({})).toBe(21);
  });

  it('leaves a room alone that has been changed by hand', () => {
    expect(resolve({ current: 22 })).toBeNull();
  });

  it('counts the away setback as untouched', () => {
    expect(resolve({ current: 18 })).toBe(21);
  });

  it('writes nothing while the room already holds the target', () => {
    expect(resolve({ current: 21 })).toBeNull();
  });

  it('offsets from a due warm-up rather than the schedule', () => {
    expect(resolve({ base: 21, current: 20 })).toBe(22);
  });

  it('hands over to the next window while Tado still shows the last window\'s offset', () => {
    expect(resolve({ offset: -0.5, current: 21 })).toBe(19.5);
  });

  it('recognises an offset Karen set before a warm-up became due', () => {
    expect(resolve({ base: 21, current: 21 })).toBe(22);
  });
});
