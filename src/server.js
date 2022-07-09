import 'newrelic';

require('console-stamp')(console);

import moment from './moment';
import express from 'express';
import alexaRoutes from './routes/alexa';
import apiRoutes from './routes/api';
import locationRoutes from './routes/location';
import authenticationRoutes from './routes/authentication';
import synologyRoutes from './routes/synology';
import smartthingsRoutes from './routes/smartthings';
import lightwaveRfRoutes from './routes/lightwaverf';
import recordingRoutes from './routes/recording';
import auth from './middleware/auth';
import { Device } from './models';
import bodyParser from 'body-parser';
import config from './config';
import cookieParser from 'cookie-parser';
import api from './api';
import { createServer } from 'http';
import compression from 'compression';
import { createBackgroundTransaction } from './helpers/newrelic';

require('./services/ifttt');
require('./services/synology');
require('./services/unifi');
require('./services/lightwaverf');
require('./services/tplink');
require('./services/smartthings');
require('./services/tado');
require('./services/alexa');
require('./services/zwave');

require('./automations');

const app = express();
const server = createServer(app);

app.set('trust proxy', config.trust_proxy);
app.use(compression());
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(cookieParser());
app.use('/graphql', auth);

api.applyMiddleware({
  app,
  path: '/graphql'
});

api.installSubscriptionHandlers(server);

app.use('/alexa', alexaRoutes);
app.use('/api', apiRoutes);
app.use('/authentication', authenticationRoutes);
app.use('/location', locationRoutes);
app.use('/synology', synologyRoutes);
app.use('/smartthings', smartthingsRoutes);
app.use('/recording', auth, recordingRoutes);
app.use('/lightwaverf', lightwaveRfRoutes);
app.use('/', express.static(__dirname + '/static'));
app.use('*', (req, res) => res.sendFile(__dirname + '/static/index.html', {
  maxAge: moment.duration(1, 'year').asMilliseconds()
}));

setInterval(createBackgroundTransaction('device:synchronize', () => Device.synchronize()), moment.duration(1, 'day').as('milliseconds'));

server.listen(config.port, () => {
  console.log(`Listening on ${config.port}`);
  console.log(`Subscriptions listening on ws://localhost:80${api.subscriptionsPath}`);
});