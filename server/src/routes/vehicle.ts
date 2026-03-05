import express, { Request } from 'express';
import smartcar from 'smartcar';
import config from '../config';
import asyncWrapper from '../helpers/express-async-wrapper';
import { Device } from '../models';
import logger from '../logger';
import { saveConfig } from '../helpers/config';
import { processSignal } from '../services/vehicle/signals';

const router = express.Router();
const smartcarRouter = express.Router();

function createAuthClient(req: Request) {
  return new smartcar.AuthClient({
    clientId: config.smartcar.client_id,
    clientSecret: config.smartcar.client_secret,
    redirectUri: `${req.protocol}://${req.get('host')}/vehicle/smartcar/callback`,
    mode: 'live',
  });
}

smartcarRouter.get('/login', (req, res) => {
  if (req.query.secret !== config.smartcar.secret) {
    return res.sendStatus(401).end();
  }

  res.redirect(createAuthClient(req).getAuthUrl());
});

// OAuth Callback Handler
smartcarRouter.get('/callback', asyncWrapper(async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    const client = createAuthClient(req);
    const tokens = await client.exchangeCode(code);

    config.smartcar.refresh_token = tokens.refreshToken;
    saveConfig();

    logger.info('SmartCar OAuth successful - refresh token saved');

    res.send(`
      <h1>SmartCar Authorization Successful!</h1>
      <p>Refresh token has been saved to config.json</p>
      <p>You can close this window.</p>
    `);
  } catch (error) {
    logger.error(error, 'SmartCar OAuth callback error');
    res.status(500).send('Authorization failed. Check server logs.');
  }
}));

smartcarRouter.post('/webhook', asyncWrapper(async (req, res) => {
  logger.debug('Received /vehicle/smartcar/webhook request');
  logger.debug(JSON.stringify(req.body));

  const { eventType } = req.body;

  // Handle webhook verification challenge
  if (eventType === 'VERIFY') {
    const hmac = smartcar.hashChallenge(
      config.smartcar.application_management_token,
      req.body.data.challenge
    );

    return res.json({ challenge: hmac });
  }

  // Handle vehicle state changes
  if (eventType === 'VEHICLE_STATE') {
    if (!smartcar.verifyPayload(
      config.smartcar.application_management_token,
      req.headers['sc-signature'] as string,
      req.body
    )) {
      logger.warn('SmartCar webhook signature verification failed');
      return res.sendStatus(400);
    }

    const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
    const ev = device.getElectricVehicleCapability();

    for (const signal of req.body.data.signals) {
      try {
        await processSignal(ev, signal);
      } catch (error) {
        logger.error(error, `Error processing webhook signal ${signal.code}`);
      }
    }

    return res.sendStatus(200);
  }

  logger.warn(`Unhandled SmartCar webhook event type: ${eventType}`);

  return res.sendStatus(200);
}));

// Mount SmartCar subrouter
router.use('/smartcar', smartcarRouter);

export default router;
