import Sequelize from 'sequelize';
import config from '../config/app';

// Every event type that a scheduled job derives by aggregating raw time-series,
// and therefore recomputes from scratch on its next run. Deleting these is safe;
// deleting anything else loses data that cannot be reconstructed.
const AGGREGATE_EVENT_TYPES = [
  // Heat pump daily metrics - services/ebusd/history.ts
  'cop_day',
  'cop_day_heating',
  'cop_day_dhw',
  'power_day',
  'power_day_heating',
  'power_day_dhw',
  'yield_day',
  'yield_day_heating',
  'yield_day_dhw',
  'cumulative_power_day',
  'cumulative_power_day_heating',
  'cumulative_power_day_dhw',
  'cumulative_yield_day',
  'cumulative_yield_day_heating',
  'cumulative_yield_day_dhw',
  // Per-device daily energy/cost - services/energy/index.ts
  'energy_day_energy',
  'energy_day_cost',
  // Vehicle monthly mileage/efficiency - services/vehicle/mileage.ts
  'monthly_mileage',
  'monthly_efficiency',
];

const instance = new Sequelize(config.database.name, config.database.user, config.database.password, {
  host: config.database.host,
  dialect: 'mysql'
});

async function main() {
  console.log('Deleting aggregate metrics...');
  console.log('Event types:', AGGREGATE_EVENT_TYPES.join(', '));

  await instance.query(
    `DELETE FROM events WHERE type IN (${AGGREGATE_EVENT_TYPES.map(() => '?').join(', ')})`,
    {
      replacements: AGGREGATE_EVENT_TYPES,
      type: Sequelize.QueryTypes.DELETE
    }
  );

  console.log('Done. Each aggregate is recalculated on its scheduled job\'s next run (or on restart).');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
