import express from 'express';
import asyncWrapper from '../../../helpers/express-async-wrapper';
import { Device } from '../../../models';
import { ThermostatUpdateRequest, ThermostatResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put('/', asyncWrapper(async (req, res) => {
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

  const body = req.body as ThermostatUpdateRequest;

  if ('targetTemperature' in body) {
    await thermostat.setTargetTemperature(body.targetTemperature);
  }

  const [targetTemperature, currentTemperature, isHeating, power, isConnected] = await Promise.all([
    thermostat.getTargetTemperature(),
    thermostat.getCurrentTemperature(),
    thermostat.getIsOn(),
    thermostat.getPower(),
    device.getIsConnected()
  ]);

  const response: ThermostatResponse = mapDeviceToResponse(device, isConnected, {
    thermostat: {
      targetTemperature,
      currentTemperature,
      isHeating,
      power
    }
  });

  res.json(response);
}));

export default router;
