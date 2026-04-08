import path from 'path';
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
    glob: ['*.js', { cwd: path.join(__dirname, '..', 'migrations') }],
    resolve: ({ name, path: filePath, context: [queryInterface, sequelize] }) => {
      const migration = require(filePath);
      return {
        name,
        up: async () => migration.up(queryInterface, sequelize),
        down: async () => migration.down(queryInterface, sequelize),
      };
    },
  },
  context: [instance.getQueryInterface(), Sequelize],
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
