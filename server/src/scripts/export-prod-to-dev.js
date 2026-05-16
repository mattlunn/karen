import config from '../config';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ENV_FILE = path.resolve(__dirname, '../.env.prod');
const skipConfirm = process.argv.includes('--yes');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: ${filePath} not found.`);
    console.error('Create it with the following contents:');
    console.error('');
    console.error('  PROD_DB_HOST=<host>');
    console.error('  PROD_DB_NAME=<database>');
    console.error('  PROD_DB_USER=<user>');
    console.error('  PROD_DB_PASSWORD=<password>');
    process.exit(1);
  }

  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }

  const required = ['PROD_DB_HOST', 'PROD_DB_NAME', 'PROD_DB_USER', 'PROD_DB_PASSWORD'];
  const missing = required.filter(k => !env[k]);
  if (missing.length) {
    console.error(`Error: Missing required keys in ${filePath}: ${missing.join(', ')}`);
    process.exit(1);
  }

  return env;
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

function run(prod, dev) {
  return new Promise((resolve, reject) => {
    const dump = spawn('mysqldump', [
      '-h', prod.host,
      '-u', prod.user,
      `--password=${prod.password}`,
      '--single-transaction',
      '--no-tablespaces',
      prod.name,
    ]);

    const restore = spawn('mysql', [
      '-h', dev.host,
      '-u', dev.user,
      `--password=${dev.password}`,
      dev.name,
    ]);

    dump.stdout.pipe(restore.stdin);

    dump.stderr.on('data', data => process.stderr.write(data));
    restore.stderr.on('data', data => process.stderr.write(data));

    dump.on('error', err => reject(new Error(`mysqldump: ${err.message}`)));
    restore.on('error', err => reject(new Error(`mysql: ${err.message}`)));

    dump.on('close', code => {
      if (code !== 0) reject(new Error(`mysqldump exited with code ${code}`));
    });

    restore.on('close', code => {
      if (code !== 0) reject(new Error(`mysql exited with code ${code}`));
      else resolve();
    });
  });
}

async function main() {
  const env = loadEnvFile(ENV_FILE);

  const prod = {
    host: env.PROD_DB_HOST,
    name: env.PROD_DB_NAME,
    user: env.PROD_DB_USER,
    password: env.PROD_DB_PASSWORD,
  };

  const dev = {
    host: config.database.host,
    name: config.database.name,
    user: config.database.user,
    password: config.database.password,
  };

  console.log(`PROD: ${prod.user}@${prod.host}/${prod.name}`);
  console.log(`DEV:  ${dev.user}@${dev.host}/${dev.name}`);
  console.log('');
  console.log('WARNING: This will overwrite all data in the DEV database.');

  if (!skipConfirm) {
    const answer = await confirm('Continue? (yes/no): ');
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  console.log('\nRunning mysqldump | mysql...');
  await run(prod, dev);
  console.log('Done.');
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
