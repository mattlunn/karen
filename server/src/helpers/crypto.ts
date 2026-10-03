import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFileSync } from 'fs';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export function readKey(path: string): Buffer {
  const key = Buffer.from(readFileSync(path, 'utf8').trim(), 'base64');

  if (key.length !== KEY_BYTES) {
    throw new Error(`${path} must hold a base64-encoded ${KEY_BYTES}-byte key`);
  }

  return key;
}

// Output is base64(iv | authTag | ciphertext), so each value carries everything needed to decrypt it.
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decrypt(encrypted: string, key: Buffer): string {
  const bytes = Buffer.from(encrypted, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, bytes.subarray(0, IV_BYTES));

  decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES));

  return Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + AUTH_TAG_BYTES)), decipher.final()]).toString('utf8');
}

function isEncryptedValue(value: object): value is { encrypted: string } {
  const keys = Object.keys(value);

  return keys.length === 1 && keys[0] === 'encrypted' && typeof (value as { encrypted: unknown }).encrypted === 'string';
}

// getKey is only called once a secret is found, so a config with no secrets in it loads without a key file.
export function decryptSecrets(value: unknown, getKey: () => Buffer, path = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => decryptSecrets(item, getKey, `${path}[${index}]`));
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (isEncryptedValue(value)) {
    try {
      return decrypt(value.encrypted, getKey());
    } catch (e) {
      throw new Error(`Unable to decrypt ${path}: ${(e as Error).message}`);
    }
  }

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decryptSecrets(child, getKey, path ? `${path}.${key}` : key)]));
}
