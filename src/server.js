require('console-stamp')(console);

import express from 'express';
import nestRoutes from './routes/nest';
import alexaRoutes from './routes/alexa';
import apiRoutes from './routes/api';
import locationRoutes from './routes/location';
import authenticationRoutes from './routes/authentication';
import synologyRoutes from './routes/synology';
import smartthingsRoutes from './routes/smartthings';
import recordingRoutes from './routes/recording';
import auth from './middleware/auth';
import { Stay, Event } from './models';
import { setEta, getOccupancyStatus, getHeatingStatus } from './services/nest';
import bodyParser from 'body-parser';
import config from './config';
import moment from 'moment-timezone';
import nowAndSetInterval from './helpers/now-and-set-interval';
import bus, * as events from './bus';
import cookieParser from 'cookie-parser';
import api from './api';
import { enqueueWorkItem } from './queue';

moment.tz.setDefault('Europe/London');

require('./services/ifttt');
require('./services/synology');
require('./services/unifi');
require('./services/lightwaverf');
require('./services/tplink');
require('./services/smartthings');

const app = express();

app.set('trust proxy', config.trust_proxy);
app.use(bodyParser.json());
app.use(cookieParser());
app.use('/graphql', auth);

api.applyMiddleware({
  app,
  path: '/graphql'
});

app.use('/nest', nestRoutes);
app.use('/alexa', alexaRoutes);
app.use('/api', apiRoutes);
app.use('/authentication', authenticationRoutes);
app.use('/location', locationRoutes);
app.use('/synology', synologyRoutes);
app.use('/smartthings', smartthingsRoutes);
app.use('/recording', auth, recordingRoutes);
app.use('/', express.static(__dirname + '/static'));
app.use('*', (req, res) => res.sendFile(__dirname + '/static/index.html', {
  maxAge: moment.duration(1, 'year').asMilliseconds()
}));

nowAndSetInterval(async () => {
  const [ stays, nextEta ] = await Promise.all([
    Stay.findCurrentStays(),
    Stay.findNextEta(moment().add(config.nest.eta_earliest_delivery_in_minutes, 'minutes'))
  ]);

  if (stays.length) {
    console.log('Not processing any ETAs, as someone is still at home...');
  } else if (!nextEta) {
    console.log('No ETAs to process...');
  } else {
    await setEta(
      nextEta.id,
      moment(nextEta.eta).subtract(config.nest.eta_window_in_minutes, 'minutes'),
      moment(nextEta.eta).add(config.nest.eta_window_in_minutes, 'minutes')
    );

    nextEta.etaSentToNestAt = new Date();
    await nextEta.save();
  }
}, moment.duration(Math.max(config.nest.eta_delivery_interval_in_minutes, 15), 'minutes').as('milliseconds'));

app.listen(config.port, () => {
  console.log(`Listening on ${config.port}`);
});

Object.keys(events).forEach((event) => {
  if (event !== 'default') {
    bus.on(event, () => {
      console.log(`Received ${event} event`);
    });
  }
});

async function updateIfChanged(deviceId, type, value) {
  const previousRecord = await Event.findOne({
    where: {
      deviceType: 'thermostat',
      deviceId,
      type,
      end: null
    },

    order: [['start', 'DESC']]
  });

  if (previousRecord === null || previousRecord.value !== value) {
    const now = Date.now();

    await Event.create({
      deviceType: 'thermostat',
      start: now,
      deviceId,
      type,
      value
    });

    if (previousRecord) {
      previousRecord.end = now;
      await previousRecord.save();
    }
  }
}

bus.on(events.NEST_OCCUPANCY_STATUS_UPDATE, async (current) => {
  await enqueueWorkItem(async () => {
    const thermostats = getHeatingStatus();

    await Promise.all(thermostats.map(thermostat => updateIfChanged(thermostat.id, 'home', Number(current.home))));
  });
});

bus.on(events.NEST_HEATING_STATUS_UPDATE, async (current) => {
  await enqueueWorkItem(async () => {
    const types = Object.keys(current).filter(key => !['name', 'id'].includes(key));

    await Promise.all(types.map(type => updateIfChanged(current.id, type, Number(current[type]))));
  });
});