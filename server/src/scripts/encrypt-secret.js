import { createInterface } from 'readline';
import { encrypt, readKey } from '../helpers/crypto';
import { KEY_PATH } from '../config';

async function readLine() {
  const readline = createInterface({ input: process.stdin });

  for await (const line of readline) {
    readline.close();
    return line;
  }

  return '';
}

async function main() {
  const key = readKey(KEY_PATH);

  process.stderr.write('Secret: ');

  const secret = await readLine();

  if (secret === '') {
    throw new Error('No secret given');
  }

  console.log(encrypt(secret, key));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
