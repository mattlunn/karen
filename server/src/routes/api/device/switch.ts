import express from 'express';
import { Device } from '../../../models';
import { SwitchUpdateRequest, DeviceApiResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse, SwitchUpdateRequest>('/', async (req, res) => {
  const device = await Device.findByIdOrError(req.params.id);

  await device.getSwitchCapability().setIsOn(req.body.isOn);

  res.json({ device: await mapDeviceToResponse(device) });
});

export default router;
