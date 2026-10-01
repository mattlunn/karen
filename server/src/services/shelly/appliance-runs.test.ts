let onPowerChanged: (event: unknown) => Promise<void>;

jest.mock('../../models/capabilities', () => ({
  DeviceCapabilityEvents: {
    onEnergyMonitorCurrentPowerChanged: (_filter: unknown, handler: typeof onPowerChanged) => {
      onPowerChanged = handler;
    }
  }
}));

jest.mock('../../helpers/newrelic', () => ({
  createBackgroundTransaction: (_name: string, cb: unknown) => cb
}));

jest.mock('../../models', () => ({}));

import { watchApplianceRuns } from './appliance-runs';

describe('watchApplianceRuns', () => {
  let runs: { start: Date; end: Date | null }[];

  const appliance = {
    async getIsRunningEvent() {
      return runs.at(-1) ?? null;
    },
    async setIsRunningState(isRunning: boolean, timestamp: Date) {
      if (isRunning) {
        runs.push({ start: timestamp, end: null });
      } else {
        runs.at(-1)!.end = timestamp;
      }
    }
  };

  const device = { id: 1, getApplianceCapability: () => appliance };

  async function reportPower(minutesFromStart: number, watts: number) {
    await jest.advanceTimersByTimeAsync(Date.UTC(2026, 9, 1) + minutesFromStart * 60 * 1000 - Date.now());
    await onPowerChanged({ value: watts, start: new Date(), getDevice: async () => device });
  }

  beforeAll(() => {
    watchApplianceRuns();
  });

  beforeEach(() => {
    runs = [];
    jest.useFakeTimers({ now: Date.UTC(2026, 9, 1) });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a dishwasher run going through its drying phase', async () => {
    await reportPower(0, 2000);
    await reportPower(140, 8);
    await reportPower(223, 23);
    await reportPower(224, 1);
    await reportPower(300, 0);

    expect(runs).toEqual([{
      start: new Date(Date.UTC(2026, 9, 1)),
      end: new Date(Date.UTC(2026, 9, 1, 3, 44))
    }]);
  });

  it('does not start a run on washing machine standby', async () => {
    await reportPower(0, 6);
    await reportPower(120, 0);

    expect(runs).toEqual([]);
  });
});
