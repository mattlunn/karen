import { readFileSync, renameSync, writeFileSync } from 'fs';
import { STATE_PATH } from './helpers/config/paths';

export interface StateValues {
  'tado.refresh_token': string;
  'alexa.refresh_token': string;
  'smartcar.user_id': string;
  'smartcar.vehicle_id': string;
}

function readValues(path: string): Partial<StateValues> {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    throw e;
  }
}

export class StateStore {
  #path: string;
  #values: Partial<StateValues>;

  constructor(path: string) {
    this.#path = path;
    this.#values = readValues(path);
  }

  get<K extends keyof StateValues>(key: K): StateValues[K] | undefined {
    return this.#values[key];
  }

  getOrThrow<K extends keyof StateValues>(key: K): StateValues[K] {
    const value = this.#values[key];

    if (value === undefined) {
      throw new Error(`${key} has not been set in ${this.#path}`);
    }

    return value;
  }

  set<K extends keyof StateValues>(key: K, value: StateValues[K]): void;
  set(values: Partial<StateValues>): void;
  set(keyOrValues: keyof StateValues | Partial<StateValues>, value?: StateValues[keyof StateValues]): void {
    const updates = typeof keyOrValues === 'string' ? { [keyOrValues]: value } : keyOrValues;
    const values = { ...this.#values, ...updates };
    const tempPath = `${this.#path}.tmp`;

    // Written to a temp file and renamed into place, so a crash mid-write can't leave a truncated file behind.
    writeFileSync(tempPath, JSON.stringify(values, null, 2));
    renameSync(tempPath, this.#path);

    this.#values = values;
  }
}

export default new StateStore(STATE_PATH);
