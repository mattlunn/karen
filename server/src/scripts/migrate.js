import { Umzug, SequelizeStorage } from 'umzug';
import Sequelize from 'sequelize';
import path from 'path';
import config from '../config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv)).array('up').array('down').argv;
const instance = new Sequelize(config.database.name, config.database.user, config.database.password, {
  host: config.database.host,
  dialect: 'mysql'
});

const queryInterface = instance.getQueryInterface();

const umzug = new Umzug({
  storage: new SequelizeStorage({ sequelize: instance }),
  context: queryInterface,
  migrations: {
    glob: path.join(__dirname, '../migrations/*.js'),
    resolve({ name, path: migrationPath }) {
      const migration = require(migrationPath);
      return {
        name,
        up: async () => migration.up(queryInterface, Sequelize),
        down: async () => migration.down(queryInterface, Sequelize),
      };
    },
  },
  logger: console,
});

let promise;

if (argv.up) {
  promise = umzug.up({ migrations: argv.up });
} else if (argv.down) {
  promise = umzug.down({ migrations: argv.down });
} else {
  promise = umzug.up();
}

promise.then(() => {
  console.log('Done');
  process.exit(0);
}).catch((err) => {
  console.log(err);
  process.exit(1);
});
