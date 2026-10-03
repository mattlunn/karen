import { randomBytes } from 'crypto';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { decrypt, decryptSecrets, encrypt, readKey } from './crypto';

const key = randomBytes(32);

describe('encrypt / decrypt', () => {
  it('round-trips a value', () => {
    expect(decrypt(encrypt('hunter2', key), key)).toBe('hunter2');
  });

  it('uses a fresh IV each time', () => {
    expect(encrypt('hunter2', key)).not.toBe(encrypt('hunter2', key));
  });

  it('rejects the wrong key', () => {
    expect(() => decrypt(encrypt('hunter2', key), randomBytes(32))).toThrow();
  });

  it('rejects a tampered ciphertext', () => {
    const bytes = Buffer.from(encrypt('hunter2', key), 'base64');

    bytes[bytes.length - 1] ^= 1;

    expect(() => decrypt(bytes.toString('base64'), key)).toThrow();
  });
});

describe('readKey', () => {
  const dir = mkdtempSync(join(tmpdir(), 'karen-key-'));

  it('reads a base64 key, ignoring surrounding whitespace', () => {
    writeFileSync(join(dir, 'good.key'), `${key.toString('base64')}\n`);

    expect(readKey(join(dir, 'good.key')).equals(key)).toBe(true);
  });

  it('rejects a key of the wrong length', () => {
    writeFileSync(join(dir, 'short.key'), randomBytes(16).toString('base64'));

    expect(() => readKey(join(dir, 'short.key'))).toThrow('32-byte key');
  });
});

describe('decryptSecrets', () => {
  it('decrypts encrypted values anywhere in the tree, leaving everything else alone', () => {
    const config = {
      port: 8081,
      octopus: { api_key: { $encrypted: encrypt('sk_live', key) }, mpan: '123' },
      tuya: { devices: [{ name: 'Fireplace', key: { $encrypted: encrypt('local-key', key) } }] },
      nothing: null
    };

    expect(decryptSecrets(config, () => key)).toEqual({
      port: 8081,
      octopus: { api_key: 'sk_live', mpan: '123' },
      tuya: { devices: [{ name: 'Fireplace', key: 'local-key' }] },
      nothing: null
    });
  });

  it('treats an object with keys besides "$encrypted" as plain config', () => {
    const value = { $encrypted: 'not-a-secret', other: true };

    expect(decryptSecrets(value, () => key)).toEqual(value);
  });

  it('never asks for the key when there are no secrets', () => {
    const getKey = jest.fn(() => key);

    decryptSecrets({ a: { b: [1, 'two'] } }, getKey);

    expect(getKey).not.toHaveBeenCalled();
  });

  it('names the path of a value that will not decrypt', () => {
    const config = { tuya: { devices: [{ key: { $encrypted: encrypt('local-key', randomBytes(32)) } }] } };

    expect(() => decryptSecrets(config, () => key)).toThrow('Unable to decrypt tuya.devices[0].key');
  });
});
