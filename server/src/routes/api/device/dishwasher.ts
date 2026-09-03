import express from 'express';
import { Device } from '../../../models';
import { DishwasherUpdateRequest, DeviceApiResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse, DishwasherUpdateRequest>('/', async (req, res) => {
  const device = await Device.findByIdOrError(req.params.id);
  const dishwasher = device.getDishwasherCapability();

  try {
    if (req.body.scheduled) {
      await dishwasher.scheduleCheapestRun();
    } else {
      await dishwasher.cancelScheduledRun();
    }
  } catch (e) {
    // The appliance refuses a start unless a program is selected and remote start
    // is enabled at the panel, and there may be no long enough published window -
    // both worth showing the user verbatim.
    res.status(409).json({ error: (e as Error).message } as any);
    return;
  }

  res.json({ device: await mapDeviceToResponse(device) });
});

export default router;
