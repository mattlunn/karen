import mysql from 'mysql2/promise';
import config from '../config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import readline from 'readline';

const argv = yargs(hideBin(process.argv))
  .option('prod-host', { type: 'string', demandOption: true, description: 'PROD database host' })
  .option('prod-name', { type: 'string', demandOption: true, description: 'PROD database name' })
  .option('prod-user', { type: 'string', demandOption: true, description: 'PROD database user' })
  .option('prod-password', { type: 'string', demandOption: true, description: 'PROD database password' })
  .option('yes', { type: 'boolean', default: false, description: 'Skip confirmation prompt' })
  .argv;

const INSERT_BATCH_SIZE = 500;

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

async function main() {
  console.log(`PROD: ${argv['prod-user']}@${argv['prod-host']}/${argv['prod-name']}`);
  console.log(`DEV:  ${config.database.user}@${config.database.host}/${config.database.name}`);
  console.log('');
  console.log('WARNING: This will DROP and recreate all tables in the DEV database.');

  if (!argv.yes) {
    const answer = await confirm('Continue? (yes/no): ');
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  const prod = await mysql.createConnection({
    host: argv['prod-host'],
    database: argv['prod-name'],
    user: argv['prod-user'],
    password: argv['prod-password'],
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
