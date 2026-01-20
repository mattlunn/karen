import express from 'express';
import asyncWrapper from '../../../helpers/express-async-wrapper';
import { Device } from '../../../models';
import { ThermostatUpdateRequest } from '../../../api/types';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, void, ThermostatUpdateRequest>('/', asyncWrapper(async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const thermostat = device.getThermostatCapability();
  if (!thermostat) {
    res.status(400).json({ error: 'Device does not have thermostat capability' });
    return;
  }

  const body = req.body;

  if ('targetTemperature' in body) {
    await thermostat.setTargetTemperature(body.targetTemperature);
  }

  res.status(204).send();
}));

export default router;
