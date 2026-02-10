import express from 'express';
import smartcar from 'smartcar';
import config from '../config';
import asyncWrapper from '../helpers/express-async-wrapper';
import { Device } from '../models';
import logger from '../logger';

const router = express.Router();

// Secret-based authentication for webhook
router.use((req, res, next) => {
  if (req.query.secret !== config.smartcar.secret) {
    return res.sendStatus(401).end();
  }
  next();
});

router.post('/webhook', asyncWrapper(async (req, res) => {
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

export default router;
