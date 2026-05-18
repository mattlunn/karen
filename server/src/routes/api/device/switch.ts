import express from 'express';
import { Device } from '../../../models';
import { SwitchUpdateRequest, DeviceApiResponse, ApiErrorResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse | ApiErrorResponse, SwitchUpdateRequest>('/', async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  if (!device.getCapabilities().includes('SWITCH')) {
    res.status(400).json({ error: 'Device does not have switch capability' });
    return;
  }

  await device.getSwitchCapability().setIsOn(req.body.isOn);

  res.json({ device: await mapDeviceToResponse(device) });
});

export default router;
