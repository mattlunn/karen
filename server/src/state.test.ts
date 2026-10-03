import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StateStore } from './state';

jest.mock('./config', () => ({ STATE_PATH: '/nonexistent/state.json' }));

function tempStatePath() {
  return join(mkdtempSync(join(tmpdir(), 'karen-state-')), 'state.json');
}

describe('StateStore', () => {
  it('starts empty when there is no file yet', () => {
    const state = new StateStore(tempStatePath());

    expect(state.get('tado.refresh_token')).toBeUndefined();
  });

  it('reads values from an existing file', () => {
    const path = tempStatePath();

    writeFileSync(path, JSON.stringify({ 'tado.refresh_token': 'abc' }));

    expect(new StateStore(path).get('tado.refresh_token')).toBe('abc');
  });

  it('sets a single value', () => {
    const state = new StateStore(tempStatePath());

    state.set('tado.refresh_token', 'abc');

    expect(state.get('tado.refresh_token')).toBe('abc');
  });

  it('keeps existing values when setting another', () => {
    const path = tempStatePath();
    const state = new StateStore(path);

    state.set('tado.refresh_token', 'abc');
    state.set('smartcar.user_id', 'user');
    state.set('smartcar.vehicle_id', 'vehicle');

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
      'tado.refresh_token': 'abc',
      'smartcar.user_id': 'user',
      'smartcar.vehicle_id': 'vehicle'
    });
  });

  it('persists across instances', () => {
    const path = tempStatePath();

    new StateStore(path).set('alexa.refresh_token', 'xyz');

    expect(new StateStore(path).get('alexa.refresh_token')).toBe('xyz');
  });

  it('getOrThrow names the missing key', () => {
    const state = new StateStore(tempStatePath());

    expect(() => state.getOrThrow('smartcar.vehicle_id')).toThrow('smartcar.vehicle_id has not been set');
  });
});
