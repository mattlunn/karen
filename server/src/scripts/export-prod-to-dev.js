import mysql from 'mysql2/promise';
import config from '../config';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

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

async function getTables(conn) {
  const [rows] = await conn.query('SHOW TABLES');
  return rows.map(row => Object.values(row)[0]);
}

async function getCreateTable(conn, table) {
  const [rows] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
  return rows[0]['Create Table'];
}

const INSERT_BATCH_SIZE = 500;

async function main() {
  const env = loadEnvFile(ENV_FILE);

  console.log(`PROD: ${env.PROD_DB_USER}@${env.PROD_DB_HOST}/${env.PROD_DB_NAME}`);
  console.log(`DEV:  ${config.database.user}@${config.database.host}/${config.database.name}`);
  console.log('');
  console.log('WARNING: This will DROP and recreate all tables in the DEV database.');

  if (!skipConfirm) {
    const answer = await confirm('Continue? (yes/no): ');
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  const prod = await mysql.createConnection({
    host: env.PROD_DB_HOST,
    database: env.PROD_DB_NAME,
    user: env.PROD_DB_USER,
    password: env.PROD_DB_PASSWORD,
  });

  const dev = await mysql.createConnection({
    host: config.database.host,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  });

  try {
    const tables = await getTables(prod);
    console.log(`\nFound ${tables.length} tables in PROD.\n`);

    await dev.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      process.stdout.write(`  ${table}...`);

      const createSql = await getCreateTable(prod, table);
      await dev.query(`DROP TABLE IF EXISTS \`${table}\``);
      await dev.query(createSql);

      const [rows] = await prod.query(`SELECT * FROM \`${table}\``);

      if (rows.length === 0) {
        console.log(' empty');
        continue;
      }

      const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
      for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
        const placeholders = batch.map(row => `(${Object.keys(row).map(() => '?').join(', ')})`).join(', ');
        const values = batch.flatMap(row => Object.values(row));
        await dev.query(`INSERT INTO \`${table}\` (${columns}) VALUES ${placeholders}`, values);
      }

      console.log(` ${rows.length} rows`);
    }

    await dev.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\nDone.');
  } finally {
    await prod.end();
    await dev.end();
  }
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
