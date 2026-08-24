import express from 'express';
import crypto from 'crypto';
import config from '../config/app';
import { Device } from '../models';
import logger from '../logger';
import { saveConfig } from '../helpers/config';
import { processSignal } from '../services/vehicle/signals';
import { synchronize } from '../services/vehicle';
import { listConnections } from '../services/vehicle/client';

const router = express.Router();
const smartcarRouter = express.Router();

const CONNECT_URL = `https://connect.smartcar.com/oauth/authorize?response_type=code&application_id=${config.smartcar.application_id}&mode=live`;

function hashChallenge(amt: string, challenge: string): string {
  return crypto.createHmac('sha256', amt).update(challenge).digest('hex');
}

function verifyPayload(amt: string, signature: string, body: unknown): boolean {
  return hashChallenge(amt, JSON.stringify(body)) === signature;
}

smartcarRouter.get('/login', (req, res) => {
  if (req.query.secret !== config.smartcar.secret) {
    return res.sendStatus(401).end();
  }

  res.redirect(CONNECT_URL);
});

// Connect Callback Handler
//
// V3 no longer exchanges the authorization code for per-vehicle tokens. Instead
// the redirect carries a `user_id`, which we persist and use (via the sc-user-id
// header) to scope all subsequent V3 API requests.
smartcarRouter.get('/callback', async (req, res) => {
  const userId = req.query.user_id as string;
  if (!userId) {
    return res.status(400).send('Missing user_id');
  }

  try {
    const { data: connections } = await listConnections(userId);
    const connection = connections[0];

    if (!connection) {
      return res.status(400).send('No vehicle connections found for this user');
    }

    config.smartcar.user_id = userId;
    config.smartcar.vehicle_id = connection.relationships.vehicle.data.id;
    saveConfig();

    logger.info(`SmartCar Connect successful - user ${userId}, vehicle ${connection.relationships.vehicle.data.id}`);

    res.send(`
      <h1>SmartCar Authorization Successful!</h1>
      <p>User and vehicle have been saved to config/app.json</p>
      <p>You can close this window.</p>
    `);
  } catch (error) {
    logger.error(error, 'SmartCar Connect callback error');
    res.status(500).send('Authorization failed. Check server logs.');
  }
});

smartcarRouter.post('/webhook', async (req, res) => {
  const { eventType } = req.body;

  // Handle webhook verification challenge
  if (eventType === 'VERIFY') {
    const hmac = hashChallenge(
      config.smartcar.application_management_token,
      req.body.data.challenge
    );

    return res.json({ challenge: hmac });
  }

  // Handle vehicle state changes
  if (eventType === 'VEHICLE_STATE') {
    if (!verifyPayload(
      config.smartcar.application_management_token,
      req.headers['sc-signature'] as string,
      req.body
    )) {
      logger.warn('SmartCar webhook signature verification failed');
      return res.sendStatus(400);
    }

    const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);

    for (const signal of req.body.data.signals) {
      try {
        await processSignal(device, signal);
      } catch (error) {
        logger.error(error, `Error processing webhook signal ${signal.code}`);
      }
    }

    return res.sendStatus(200);
  }

  logger.warn(`Unhandled SmartCar webhook event type: ${eventType}`);

  return res.sendStatus(200);
});

smartcarRouter.get('/update', async (req, res) => {
  if (req.query.secret !== config.smartcar.secret) {
    return res.sendStatus(401);
  }

  try {
    await synchronize();
    res.sendStatus(200);
  } catch (err) {
    logger.error(err, 'Error during manual vehicle sync');
    res.sendStatus(500);
  }
});

// Mount SmartCar subrouter
router.use('/smartcar', smartcarRouter);

export default router;
