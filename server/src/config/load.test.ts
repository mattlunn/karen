import { randomBytes } from 'crypto';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { encrypt } from './crypto';
import { loadConfig } from './load';

describe('loadConfig', () => {
  it('loads app.json with its secrets decrypted', () => {
    const dir = mkdtempSync(join(tmpdir(), 'karen-config-'));
    const key = randomBytes(32);

    writeFileSync(join(dir, 'config.key'), key.toString('base64'));
    writeFileSync(join(dir, 'app.json'), JSON.stringify({ port: 8081, octopus: { api_key: { encrypted: encrypt('sk_live', key) } } }));

    expect(loadConfig(join(dir, 'app.json'), join(dir, 'config.key'))).toEqual({ port: 8081, octopus: { api_key: 'sk_live' } });
  });
});
