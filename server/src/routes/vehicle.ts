import express, { Request } from 'express';
import smartcar from 'smartcar';
import config from '../config';
import asyncWrapper from '../helpers/express-async-wrapper';
import { Device } from '../models';
import logger from '../logger';
import { saveConfig } from '../helpers/config';

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
  // Handle authorization errors
  if (req.query.error) {
    logger.error({ error: req.query.error }, 'SmartCar OAuth authorization denied');
    return res.status(400).send(`Authorization failed: ${req.query.error}`);
  }

  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Create auth client with same redirect URI
    const client = createAuthClient(req);

    // Exchange code for tokens
    const tokens = await client.exchangeCode(code);

    // Store refresh token in config
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

// Webhook endpoint (moved from /webhook to /smartcar/webhook)
smartcarRouter.post('/webhook', asyncWrapper(async (req, res) => {
  const signature = req.headers['sc-signature'] as string;

  if (!signature || !smartcar.verifyPayload(
    config.smartcar.application_management_token,
    signature,
    req.body
  )) {
    logger.warn('SmartCar webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { eventType } = req.body;

  logger.debug('Received /vehicle/smartcar/webhook request');
  logger.debug(JSON.stringify(req.body));

  // Handle webhook verification challenge
  if (eventType === 'VERIFY') {
    const challenge = req.body.data?.challenge;
    if (!challenge) {
      return res.status(400).json({ error: 'Missing challenge' });
    }

    const hmac = smartcar.hashChallenge(
      config.smartcar.application_management_token,
      challenge
    );

    return res.json({ challenge: hmac });
  }

  // Handle vehicle state changes
  if (eventType === 'VEHICLE_STATE') {
    const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
    const ev = device.getElectricVehicleCapability();

    for (const signal of req.body.data.signals) {
      try {
        switch (signal.code) {
          case 'tractionbattery-stateofcharge':
            await ev.setChargePercentageState(signal.body.value);
            break;
          case 'charge-ischarging':
            await ev.setIsChargingState(signal.body.value);
            break;
          case 'odometer-traveleddistance':
            await ev.setOdometerState(signal.body.value * 0.621371);
            break;
          case 'charge-amperagemax': {
            const values = signal.body.values;
            
            if (!Array.isArray(values) || values.length !== 1) {
              throw new Error(`Expected exactly 1 charge limit value, got ${values?.length}`);
            }

            await ev.setChargeLimitState(values[0].limit);
            break;
          }
          default:
            logger.debug({ code: signal.code }, 'Unrecognized webhook signal code');
            break;
        }
      } catch (error) {
        logger.error(error, `Error processing webhook signal ${signal.code}`);
      }
    }

    return res.sendStatus(200);
  }

  // Handle vehicle errors
  if (eventType === 'VEHICLE_ERROR') {
    logger.error(req.body, 'SmartCar webhook vehicle error');
    return res.sendStatus(200);
  }

  // Unknown event type
  logger.warn({ eventType }, 'Unknown webhook event type');
  return res.sendStatus(200);
}));

// Mount SmartCar subrouter
router.use('/smartcar', smartcarRouter);

export default router;
