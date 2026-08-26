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
import tadoRoutes from './routes/tado';
import vehicleRoutes from './routes/vehicle';
import versionRoutes from './routes/version';
import auth from './middleware/auth';
import buildVersion from './middleware/build-version';
import { Device } from './models';
import config from './config/app';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import compression from 'compression';
import { createBackgroundTransaction } from './helpers/newrelic';

require('./services/synology');
require('./services/unifi');
require('./services/tplink');
require('./services/tuya');
require('./services/tado');
require('./services/alexa');
require('./services/zwave');
require('./services/pushover');
require('./services/shelly');
require('./services/sony-bravia');
require('./services/ebusd');
require('./services/homeconnect');
require('./services/vehicle');
require('./services/bins');
require('./services/octopus');
require('./services/energy');

require('./automations');

const app = express();

const httpServer = createServer(app);

app.set('trust proxy', config.trust_proxy);
app.use(compression());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({
  // The Alexa custom skill signs the exact bytes it sends, which re-serialising the parsed body
  // would not reproduce. See services/alexa/skill/verify-request.
  verify: (req, res, buffer) => {
    (req as express.Request).rawBody = buffer;
  }
}));
app.use(express.text());
app.use(cookieParser());
app.use(buildVersion);

app.use('/alexa', alexaRoutes);
app.use('/api', auth, apiRoutes);
app.use('/authentication', authenticationRoutes);
app.use('/location', locationRoutes);
app.use('/synology', synologyRoutes);
app.use('/homeconnect', homeConnectRoutes);
app.use('/tado', tadoRoutes);
app.use('/vehicle', vehicleRoutes);
app.use('/version', versionRoutes);
app.use('/', express.static(__dirname + '/static'));

// The SPA is served for any unmatched path so that client-side routes survive a hard refresh. That
// only makes sense for a page load — answering a POST to a mistyped endpoint with 200 and a page of
// HTML hides the mistake from whatever sent it, which is how a stale Alexa endpoint URL went
// unnoticed for months.
app.use((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.sendStatus(404);

    return;
  }

  res.sendFile('index.html', {
    root: __dirname + '/static',
    maxAge: dayjs.duration(1, 'year').asMilliseconds()
  });
});

httpServer.listen(config.port, () => {
  logger.info(`Listening on ${config.port}`);
});

setInterval(createBackgroundTransaction('device:synchronize', () => Device.synchronize()), dayjs.duration(1, 'day').asMilliseconds());
