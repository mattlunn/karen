const mockHandlers: ((event: unknown) => Promise<void>)[] = [];
const mockFindByNameOrError = jest.fn();

jest.mock('../helpers/newrelic', () => ({
  createBackgroundTransaction: (_name: string, cb: (...args: unknown[]) => Promise<unknown>) => cb
}));

jest.mock('../models', () => ({
  Device: { findByNameOrError: (name: string) => mockFindByNameOrError(name) }
}));

jest.mock('../models/capabilities', () => ({
  DeviceCapabilityEvents: {
    onLightIsOnChanged: (_filter: unknown, handler: (event: unknown) => Promise<void>) => mockHandlers.push(handler)
  }
}));

import lightAutoOff from './light-auto-off';

function createLight(isOnEvent: { start: Date; end: Date | null } | null) {
  const setIsOn = jest.fn().mockResolvedValue(undefined);

  const light = {
    getLightCapability: () => ({
      setIsOn,
      getIsOnEvent: async () => isOnEvent && { ...isOnEvent, hasEnded: () => isOnEvent.end !== null }
    })
  };

  return { light, setIsOn };
}

function lightEvent(light: unknown, start: Date, end: Date | null) {
  return { start, hasEnded: () => end !== null, getDevice: async () => light };
}

async function flush() {
  await jest.advanceTimersByTimeAsync(0);
}

describe('light-auto-off', () => {
  const now = new Date('2026-11-22T20:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers({ now });
    mockHandlers.length = 0;
    mockFindByNameOrError.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('turns the light off once it has been on for the delay', async () => {
    const { light, setIsOn } = createLight(null);

    mockFindByNameOrError.mockResolvedValue(light);
    lightAutoOff({ lights: [{ lightName: 'Light', offDelayMinutes: 10 }] });
    await flush();

    await mockHandlers[0](lightEvent(light, now, null));
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000 - 1);
    expect(setIsOn).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(setIsOn).toHaveBeenCalledWith(false);
  });

  it('does nothing if the light is turned off before the delay', async () => {
    const { light, setIsOn } = createLight(null);

    mockFindByNameOrError.mockResolvedValue(light);
    lightAutoOff({ lights: [{ lightName: 'Light', offDelayMinutes: 10 }] });
    await flush();

    await mockHandlers[0](lightEvent(light, now, null));
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
    await mockHandlers[0](lightEvent(light, now, new Date()));
    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(setIsOn).not.toHaveBeenCalled();
  });

  it('counts the delay from when a light already on at startup came on', async () => {
    const { light, setIsOn } = createLight({ start: new Date(now.getTime() - 7 * 60 * 1000), end: null });

    mockFindByNameOrError.mockResolvedValue(light);
    lightAutoOff({ lights: [{ lightName: 'Light', offDelayMinutes: 10 }] });
    await flush();

    await jest.advanceTimersByTimeAsync(3 * 60 * 1000 - 1);
    expect(setIsOn).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(setIsOn).toHaveBeenCalledWith(false);
  });

  it('turns off straight away a light already on at startup for longer than the delay', async () => {
    const { light, setIsOn } = createLight({ start: new Date(now.getTime() - 60 * 60 * 1000), end: null });

    mockFindByNameOrError.mockResolvedValue(light);
    lightAutoOff({ lights: [{ lightName: 'Light', offDelayMinutes: 10 }] });
    await flush();

    expect(setIsOn).toHaveBeenCalledWith(false);
  });

  it('leaves a light that is off at startup alone', async () => {
    const { light, setIsOn } = createLight({ start: new Date(now.getTime() - 60 * 60 * 1000), end: now });

    mockFindByNameOrError.mockResolvedValue(light);
    lightAutoOff({ lights: [{ lightName: 'Light', offDelayMinutes: 10 }] });
    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(setIsOn).not.toHaveBeenCalled();
  });
});
