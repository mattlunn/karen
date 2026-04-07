import express from 'express';
import { Device } from '../../../models';
import { ThermostatUpdateRequest, DeviceApiResponse, ApiErrorResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse | ApiErrorResponse, ThermostatUpdateRequest>('/', async (req, res) => {
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
    await thermostat.setTargetTemperature(body.targetTemperature === 0 ? null : body.targetTemperature);
  }

  const deviceResponse = await mapDeviceToResponse(device);

  const response: DeviceApiResponse = {
    device: deviceResponse
  };

  res.json(response);
});

export default router;
