import express from 'express';
import smartcar from 'smartcar';
import config from '../config';
import asyncWrapper from '../helpers/express-async-wrapper';
import { Device } from '../models';
import logger from '../logger';
import { saveConfig } from '../helpers/config';

const router = express.Router();

// Secret-based authentication for all vehicle routes
router.use((req, res, next) => {
  if (req.query.secret !== config.smartcar.secret) {
    return res.sendStatus(401).end();
  }
  next();
});

// Create SmartCar subrouter
const smartcarRouter = express.Router();

/**
 * Helper function to create AuthClient with redirect URI inferred from request
 */
function createAuthClient(req: express.Request) {
  const redirectUri = `${req.protocol}://${req.get('host')}/vehicle/smartcar/callback`;
  return new smartcar.AuthClient({
    clientId: config.smartcar.client_id,
    clientSecret: config.smartcar.client_secret,
    redirectUri,
    mode: 'live',
  });
}

// OAuth Login Flow
smartcarRouter.get('/login', (req, res) => {
  const client = createAuthClient(req);
  const authUrl = client.getAuthUrl();
  res.redirect(authUrl);
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
  const { eventType } = req.body;

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

    const vehicles = req.body.vehicles || [];
    for (const vehicleData of vehicles) {
      if (vehicleData.id !== config.smartcar.vehicle_id) {
        continue; // Not our vehicle
      }

      const changes = vehicleData.changes || [];
      for (const change of changes) {
        const changeType = change.type;
        const data = change.data;

        try {
          if (changeType === 'BATTERY' && data) {
            // Battery percentage change
            if (typeof data.percentRemaining === 'number') {
              await ev.setChargePercentageState(data.percentRemaining * 100);
            }
          } else if (changeType === 'CHARGE' && data) {
            // Charge status change
            if (typeof data.isCharging === 'boolean') {
              await ev.setIsChargingState(data.isCharging);
            }
            if (data.state) {
              await ev.setIsChargingState(data.state === 'CHARGING');
            }
          } else if (changeType === 'ODOMETER' && data) {
            // Odometer change (km to miles)
            if (typeof data.distance === 'number') {
              await ev.setOdometerState(data.distance * 0.621371);
            }
          } else if (changeType === 'CHARGE_LIMIT' && data) {
            // Charge limit change
            if (typeof data.limit === 'number') {
              await ev.setChargeLimitState(data.limit * 100);
            }
          }
        } catch (error) {
          logger.error(error, `Error processing webhook change type ${changeType}`);
        }
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
