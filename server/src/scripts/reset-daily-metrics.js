import Sequelize from 'sequelize';
import config from '../config';

const DAILY_METRIC_EVENT_TYPES = [
  'cop_day',
  'cop_day_heating',
  'cop_day_dhw',
  'power_day',
  'power_day_heating',
  'power_day_dhw',
  'yield_day',
  'yield_day_heating',
  'yield_day_dhw'
];

const instance = new Sequelize(config.database.name, config.database.user, config.database.password, {
  host: config.database.host,
  dialect: 'mysql'
});

async function main() {
  console.log('Deleting daily heat pump metrics...');
  console.log('Event types:', DAILY_METRIC_EVENT_TYPES.join(', '));

  await instance.query(
    `DELETE FROM events WHERE type IN (${DAILY_METRIC_EVENT_TYPES.map(() => '?').join(', ')})`,
    {
      replacements: DAILY_METRIC_EVENT_TYPES,
      type: Sequelize.QueryTypes.DELETE
    }
  );

  console.log('Done. The app will recalculate metrics at midnight or on next restart.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
