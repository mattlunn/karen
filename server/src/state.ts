import { readFileSync, writeFileSync } from 'fs';
import { STATE_PATH } from './helpers/config/paths';

function readValues(path: string): Record<string, string> {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    // The file is only created by the first set(), so its absence just means nothing's been stored yet.
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    throw e;
  }
}

export class StateStore {
  #path: string;
  #values: Record<string, string>;

  constructor(path: string) {
    this.#path = path;
    this.#values = readValues(path);
  }

  get(key: string): string | undefined {
    return this.#values[key];
  }

  getOrThrow(key: string): string {
    const value = this.#values[key];

    if (value === undefined) {
      throw new Error(`${key} has not been set in ${this.#path}`);
    }

    return value;
  }

  set(key: string, value: string): void;
  set(values: Record<string, string>): void;
  set(keyOrValues: string | Record<string, string>, value?: string): void {
    const updates = typeof keyOrValues === 'string' ? { [keyOrValues]: value! } : keyOrValues;
    const values = { ...this.#values, ...updates };

    writeFileSync(this.#path, JSON.stringify(values, null, 2));
    this.#values = values;
  }
}

export default new StateStore(STATE_PATH);
