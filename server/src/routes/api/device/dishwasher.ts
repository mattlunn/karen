import express from 'express';
import { Device } from '../../../models';
import { DishwasherUpdateRequest, DeviceApiResponse, ApiErrorResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse | ApiErrorResponse, DishwasherUpdateRequest>('/', async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  if (!device.getCapabilities().includes('DISHWASHER')) {
    res.status(400).json({ error: 'Device does not have dishwasher capability' });
    return;
  }

  try {
    await device.getDishwasherCapability().toggleMealSchedule(req.body.meal);
  } catch (e) {
    // e.g. no program selected, or remote start not enabled at the panel.
    res.status(409).json({ error: (e as Error).message });
    return;
  }

  res.json({ device: await mapDeviceToResponse(device) });
});

export default router;
