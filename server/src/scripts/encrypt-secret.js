import { createInterface } from 'readline';
import { join } from 'path';
import { encrypt, readKey } from '../helpers/crypto';

async function readLine() {
  const readline = createInterface({ input: process.stdin });

  for await (const line of readline) {
    readline.close();
    return line;
  }

  return '';
}

async function main() {
  const key = readKey(join(__dirname, '../../config/config.key'));

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
