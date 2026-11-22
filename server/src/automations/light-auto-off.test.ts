const mockHandlers: ((event: unknown) => Promise<void>)[] = [];
const mockNotify = jest.fn();

jest.mock('../helpers/newrelic', () => ({
  createBackgroundTransaction: (_name: string, cb: (...args: unknown[]) => Promise<unknown>) => cb
}));

jest.mock('../models', () => ({
  Log: { notify: (options: unknown) => mockNotify(options) }
}));

jest.mock('../models/capabilities', () => ({
  DeviceCapabilityEvents: {
    onLightIsOnChanged: (_filter: unknown, handler: (event: unknown) => Promise<void>) => mockHandlers.push(handler)
  }
}));

import lightAutoOff from './light-auto-off';

function createLight() {
  const setIsOn = jest.fn().mockResolvedValue(undefined);
  const light = { name: 'Porch', getLightCapability: () => ({ setIsOn }) };

  return { light, setIsOn };
}

function lightEvent(light: unknown, isOn: boolean) {
  return { hasEnded: () => !isOn, getDevice: async () => light };
}

describe('light-auto-off', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockHandlers.length = 0;
    mockNotify.mockReset();
    lightAutoOff({ lights: [{ lightName: 'Light', offDelayMinutes: 10 }] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('turns the light off once it has been on for the delay', async () => {
    const { light, setIsOn } = createLight();

    await mockHandlers[0](lightEvent(light, true));
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000 - 1);
    expect(setIsOn).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(setIsOn).toHaveBeenCalledWith(false);
    expect(mockNotify).toHaveBeenCalledWith({
      severity: 'info',
      devices: [light],
      message: 'Turning off Porch, as it has been left on for 10 minutes'
    });
  });

  it('does nothing if the light is turned off before the delay', async () => {
    const { light, setIsOn } = createLight();

    await mockHandlers[0](lightEvent(light, true));
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
    await mockHandlers[0](lightEvent(light, false));
    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(setIsOn).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('restarts the delay when the light is turned back on', async () => {
    const { light, setIsOn } = createLight();

    await mockHandlers[0](lightEvent(light, true));
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
    await mockHandlers[0](lightEvent(light, false));
    await mockHandlers[0](lightEvent(light, true));
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000 - 1);
    expect(setIsOn).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(setIsOn).toHaveBeenCalledTimes(1);
  });
});
