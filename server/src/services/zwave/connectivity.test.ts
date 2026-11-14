import dayjs from '../../dayjs';
import { checkConnectivity, ZWaveNodeConnectivityState } from './connectivity';

const now = new Date('2026-11-14T12:00:00.000Z');

function hoursAgo(hours: number): string {
  return dayjs(now).subtract(hours, 'hour').toISOString();
}

function listening(lastSeen: string | undefined, status = 4): ZWaveNodeConnectivityState {
  return { status, isListening: true, isFrequentListening: false, statistics: { lastSeen } };
}

function frequentListening(lastSeen: string | undefined): ZWaveNodeConnectivityState {
  return { status: 4, isListening: false, isFrequentListening: '1000ms', statistics: { lastSeen } };
}

function sleeping(lastSeen: string | undefined, wakeUpInterval?: number): ZWaveNodeConnectivityState {
  return {
    status: 1,
    isListening: false,
    isFrequentListening: false,
    statistics: { lastSeen },
    values: wakeUpInterval === undefined ? [] : [{ commandClass: 132, property: 'wakeUpInterval', value: wakeUpInterval }]
  };
}

describe('checkConnectivity', () => {
  it('is disconnected when zwave-js has marked the node dead, however recently it was seen', () => {
    expect(checkConnectivity(listening(hoursAgo(0), 3), now)).toBe('disconnected');
  });

  it('is connected when a listening node was heard from within 4 hours', () => {
    expect(checkConnectivity(listening(hoursAgo(3.9)), now)).toBe('connected');
  });

  it('pings a listening node that has been quiet for 4 hours', () => {
    expect(checkConnectivity(listening(hoursAgo(4)), now)).toBe('ping');
  });

  it('pings a listening node that has never been seen', () => {
    expect(checkConnectivity(listening(undefined), now)).toBe('ping');
  });

  it('treats a frequently listening node like a listening one', () => {
    expect(checkConnectivity(frequentListening(hoursAgo(1)), now)).toBe('connected');
    expect(checkConnectivity(frequentListening(hoursAgo(68)), now)).toBe('ping');
  });

  it('is connected when a sleeping node was heard from within two wake-up intervals', () => {
    expect(checkConnectivity(sleeping(hoursAgo(4), 7200), now)).toBe('connected');
  });

  it('is disconnected when a sleeping node has missed two wake-ups', () => {
    expect(checkConnectivity(sleeping(hoursAgo(4.1), 7200), now)).toBe('disconnected');
  });

  it('is disconnected when a sleeping node has never been seen', () => {
    expect(checkConnectivity(sleeping(undefined, 7200), now)).toBe('disconnected');
  });

  it('cannot tell for a sleeping node that never wakes on a schedule', () => {
    expect(checkConnectivity(sleeping(hoursAgo(72), 0), now)).toBe('unknowable');
    expect(checkConnectivity(sleeping(hoursAgo(72)), now)).toBe('unknowable');
  });
});
