import { readFileSync } from 'fs';
import { decryptSecrets, readKey } from './crypto';
import { AppConfig } from './types';

export function loadConfig(appConfigPath: string, keyPath: string): AppConfig {
  let key: Buffer | undefined;

  return decryptSecrets(JSON.parse(readFileSync(appConfigPath, 'utf8')), () => key ??= readKey(keyPath)) as AppConfig;
}
