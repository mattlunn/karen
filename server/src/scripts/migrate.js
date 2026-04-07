import { Umzug, SequelizeStorage } from 'umzug';
import Sequelize from 'sequelize';
import config from '../config';
import yargs from 'yargs';

const argv = yargs.array('up').array('down').argv;
const instance = new Sequelize(config.database.name, config.database.user, config.database.password, {
  host: config.database.host,
  dialect: 'mysql'
});

const umzug = new Umzug({
  migrations: {
    glob: ['../migrations/*.js', { cwd: __dirname }],
    resolve: ({ name, path: migrationPath, context }) => {
      const migration = require(migrationPath);
      return {
        name,
        up: async () => migration.up(context, Sequelize),
        down: async () => migration.down(context, Sequelize),
      };
    },
  },
  context: instance.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize: instance }),
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
