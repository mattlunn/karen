import express from 'express';
import nestRoutes from './routes/nest';
import alexaRoutes from './routes/alexa';
import apiRoutes from './routes/api';
import locationRoutes from './routes/location';
import { Stay } from './models';
import { setEta } from './nest';
import bodyParser from 'body-parser';
import config from './config';
import moment from 'moment';
import nowAndSetInterval from './helpers/now-and-set-interval';

require('./ifttt');

const app = express();

app.use(bodyParser.json());
app.use('/nest', nestRoutes);
app.use('/alexa', alexaRoutes);
app.use('/api', apiRoutes);
app.use('/location', locationRoutes);
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

app.listen(config.port, () => {
  console.log(`Listening on ${config.port}`);
});