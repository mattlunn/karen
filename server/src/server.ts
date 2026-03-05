import 'newrelic';

import logger from './logger';
import dayjs from './dayjs';
import express from 'express';
import alexaRoutes from './routes/alexa';
import apiRoutes from './routes/api';
import locationRoutes from './routes/location';
import authenticationRoutes from './routes/authentication';
import synologyRoutes from './routes/synology';
import homeConnectRoutes from './routes/homeconnect';
import shellyRoutes from './routes/shelly';
import tadoRoutes from './routes/tado';
import vehicleRoutes from './routes/vehicle';
import auth from './middleware/auth';
import { Device } from './models';
import bodyParser from 'body-parser';
import config from './config';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import compression from 'compression';
import { createBackgroundTransaction } from './helpers/newrelic';

require('./services/synology');
require('./services/unifi');
require('./services/tplink');
require('./services/tado');
require('./services/alexa');
require('./services/zwave');
require('./services/pushover');
require('./services/shelly');
require('./services/ebusd');
require('./services/homeconnect');
require('./services/vehicle');

require('./automations');

const app = express();

const httpServer = createServer(app);

app.set('trust proxy', config.trust_proxy);
app.use(compression());
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(cookieParser());

app.use('/alexa', alexaRoutes);
app.use('/api', auth, apiRoutes);
app.use('/authentication', authenticationRoutes);
app.use('/location', locationRoutes);
app.use('/synology', synologyRoutes);
app.use('/shelly', shellyRoutes);
app.use('/homeconnect', homeConnectRoutes);
app.use('/tado', tadoRoutes);
app.use('/vehicle', vehicleRoutes);
app.use('/', express.static(__dirname + '/static'));

app.use('*', (req, res) => res.sendFile(__dirname + '/static/index.html', {
  maxAge: dayjs.duration(1, 'year').asMilliseconds()
}));

httpServer.listen(config.port, () => {
  logger.info(`Listening on ${config.port}`);
});

setInterval(createBackgroundTransaction('device:synchronize', () => Device.synchronize()), dayjs.duration(1, 'day').asMilliseconds());
