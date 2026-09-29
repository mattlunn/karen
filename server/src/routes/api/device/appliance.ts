import express from 'express';
import { Device } from '../../../models';
import { ApplianceUpdateRequest, DeviceApiResponse, ApiErrorResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse | ApiErrorResponse, ApplianceUpdateRequest>('/', async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  if (!device.getCapabilities().includes('APPLIANCE')) {
    res.status(400).json({ error: 'Device does not have appliance capability' });
    return;
  }

  const { tabletsRemaining } = req.body;

  if (typeof tabletsRemaining !== 'number' || !Number.isInteger(tabletsRemaining) || tabletsRemaining < 0) {
    res.status(400).json({ error: 'tabletsRemaining must be a non-negative integer' });
    return;
  }

  await device.getApplianceCapability().setTabletsLastCounted(tabletsRemaining);

  const deviceResponse = await mapDeviceToResponse(device);
  const response: DeviceApiResponse = {
    device: deviceResponse
  };

  res.json(response);
});

export default router;
