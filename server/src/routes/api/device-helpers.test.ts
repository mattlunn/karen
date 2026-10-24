jest.mock('../../config', () => ({}));
jest.mock('../../models', () => ({}));

import { getLastSeenFromCapabilities } from './device-helpers';
import type { BooleanStateApiResponse, CapabilityApiResponse, NumericStateApiResponse } from '../../api/types';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

function state(value: boolean, lastReported: string): BooleanStateApiResponse {
  return { start: '2026-09-15T12:00:00.000Z', end: null, lastReported, value, isComputed: false };
}

function reading(lastReported: string, isComputed: boolean): NumericStateApiResponse {
  return { start: '2026-09-15T12:00:00.000Z', end: null, lastReported, value: 0, isComputed };
}

function motionSensor(lastReported: string): CapabilityApiResponse {
  return { type: 'MOTION_SENSOR', hasMotion: state(false, lastReported), instanceId: null, instanceName: null };
}

function connectivity(isConnected: boolean, lastReported: string): CapabilityApiResponse {
  return { type: 'CONNECTIVITY', isConnected: state(isConnected, lastReported), instanceId: null, instanceName: null };
}

function energyMonitor(currentPowerLastReported: string, dayTotalsLastReported: string): CapabilityApiResponse {
  return {
    type: 'ENERGY_MONITOR',
    currentPower: reading(currentPowerLastReported, false),
    dayEnergy: reading(dayTotalsLastReported, true),
    dayCost: reading(dayTotalsLastReported, true),
    agileAvgPrice: null,
    instanceId: null,
    instanceName: null
  };
}

describe('getLastSeenFromCapabilities', () => {
  it('ignores a disconnected state re-confirmed after the device went offline', () => {
    const capabilities = [
      motionSensor('2026-09-15T12:27:27.000Z'),
      connectivity(false, '2026-10-15T07:07:00.000Z'),
    ];

    expect(getLastSeenFromCapabilities(capabilities, createdAt)).toBe('2026-09-15T12:27:27.000Z');
  });

  it('counts a connected state', () => {
    const capabilities = [
      motionSensor('2026-09-15T12:27:27.000Z'),
      connectivity(true, '2026-10-15T07:07:00.000Z'),
    ];

    expect(getLastSeenFromCapabilities(capabilities, createdAt)).toBe('2026-10-15T07:07:00.000Z');
  });

  it('falls back to the given date when a disconnected state is the only report', () => {
    expect(getLastSeenFromCapabilities([connectivity(false, '2026-10-15T07:07:00.000Z')], createdAt)).toBe('2026-01-01T00:00:00.000Z');
  });

  it('ignores daily energy totals Karen recomputes after the device stopped reporting', () => {
    expect(getLastSeenFromCapabilities([energyMonitor('2026-09-20T14:41:00.000Z', '2026-10-15T07:22:00.000Z')], createdAt)).toBe('2026-09-20T14:41:00.000Z');
  });
});
