import { encrypt, readKey } from '../helpers/config/crypto';
import { KEY_PATH } from '../helpers/config/paths';

function promptHidden(prompt) {
  return new Promise((resolve, reject) => {
    let input = '';

    function finish(callback) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeAllListeners('data');
      process.stderr.write('\n');
      callback();
    }

    process.stderr.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.on('data', (chars) => {
      for (const char of chars) {
        if (char === '\r' || char === '\n') {
          return finish(() => resolve(input));
        }

        if (char === '\u0003') {
          return finish(() => reject(new Error('Cancelled')));
        }

        if (char === '\u007f' || char === '\b') {
          input = input.slice(0, -1);
        } else {
          input += char;
        }
      }
    });
  });
}

async function readPiped() {
  let input = '';

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return input.replace(/\r?\n$/, '');
}

async function main() {
  const key = readKey(KEY_PATH);
  const secret = process.stdin.isTTY ? await promptHidden('Secret: ') : await readPiped();

  if (secret === '') {
    throw new Error('No secret given');
  }

  console.log(encrypt(secret, key));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
