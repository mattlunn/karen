import { Event } from '../models';
import { COMPUTED_EVENT_TYPES } from '../models/capabilities';

async function main() {
  console.log('Deleting aggregate metrics...');
  console.log('Event types:', COMPUTED_EVENT_TYPES.join(', '));

  await Event.destroy({
    where: {
      type: COMPUTED_EVENT_TYPES
    }
  });

  console.log('Done. Each aggregate is recalculated on its scheduled job\'s next run (or on restart).');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
