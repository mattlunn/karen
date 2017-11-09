import express from 'express';
import nestRoutes from './routes/nest';
import alexaRoutes from './routes/alexa';
import apiRoutes from './routes/api';
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
app.use('/api', apiRoutes);
app.use('/', express.static(__dirname + '/static'));
app.use('*', (req, res) => res.sendFile(__dirname + '/static/index.html', {
  maxAge: moment.duration(1, 'year').asMilliseconds()
}));

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

    stay.etaSentToNestAt = new Date();
    await stay.save();
  } else {
    console.info('No unsent ETAs...');
  }
}, moment.duration(Math.max(config.nest.eta_delivery_interval_in_minutes, 15), 'minutes').as('milliseconds'));

watchPresence().on('home', async () => {
  const now = new Date();
  let [current, upcoming] = await Promise.all([
    Stay.findCurrentStay(),
    Stay.findUpcomingStay()
  ]);

  if (current) {
    return console.log('Ignoring stay beginning at ' + now.toString() + ' as there is already a current stay');
  }

  if (upcoming === null) {
    upcoming = new Stay();
  }

  upcoming.arrival = new Date();
  await upcoming.save();

  console.log('Detected stay beginning at ' + upcoming.arrival.toString());
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