import express from 'express';
import nestRoutes from './routes/nest';
import alexaRoutes from './routes/alexa';
import { Stay } from './models';
import { setEta, watchPresence } from './nest';
import bodyParser from 'body-parser';
import config from './config';
import moment from 'moment';
import nowAndSetInterval from './helpers/now-and-set-interval';

const app = express();

app.use(bodyParser.json());
app.use('/nest', nestRoutes);
app.use('/alexa', alexaRoutes);

nowAndSetInterval(async () => {
  const [stay, ...rest] = await Stay.getUnsentEtasBefore(
    moment().add(config.nest.eta_earliest_delivery_in_minutes, 'minutes')
  );

  if (rest.length) {
    console.error('How did we end up with 2 unsent ETAs?');
  } else if (stay) {
    await setEta(
      stay.id,
      moment(stay.eta).subtract(config.nest.eta_window_in_minutes, 'minutes'),
      moment(stay.eta).add(config.nest.eta_window_in_minutes, 'minutes')
    );

    stay.etaSentToNestAt = moment();
    await stay.save();
  } else {
    console.info('No unsent ETAs...');
  }
}, moment.duration(Math.max(config.nest.eta_delivery_interval_in_minutes, 15), 'minutes').as('milliseconds'));

watchPresence().on('home', async () => {
  let stay = await Stay.findUpcomingStay();

  if (stay === null) {
    stay = new Stay();
  }

  stay.arrival = new Date();
  await stay.save();

  console.log('Detected stay beginning at ' + stay.arrival.toString());
}).on('away', async () => {
  let stay = await Stay.findCurrentStay();

  if (stay === null) {
    stay = new Stay();
    stay.arrival = new Date();
  }

  stay.departure = new Date();
  await stay.save();

  console.log('Detected stay ending at ' + stay.departure.toString());
});

app.listen(config.port, () => {
  console.log(`Listening on ${config.port}`);
});