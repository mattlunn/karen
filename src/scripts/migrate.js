import Umzug from 'umzug';
import Sequelize from 'sequelize';
import config from '../config';
import yargs from 'yargs';

const argv = yargs.array('up').array('down').argv;
const instance = new Sequelize(config.database.name, config.database.user, config.database.password, {
  host: config.database.host,
  dialect: 'mysql'
});

const umzug = new Umzug({
  storage: 'sequelize',
  storageOptions: {
    sequelize: instance
  },
  migrations: {
    pattern: /^\d+[\w-]+\.js$/,
    params: [instance.getQueryInterface(), Sequelize],
    path: __dirname + '/../migrations'
  }
});

let promise;

if (argv.up) {
  promise = umzug.execute({
    migrations: argv.up,
    method: 'up'
  });
} else if (argv.down) {
  promise = umzug.execute({
    migrations: argv.down,
    method: 'down'
  });
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