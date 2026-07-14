import express from 'express';
import { Device } from '../../../models';
import { TelevisionUpdateRequest, DeviceApiResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse, TelevisionUpdateRequest>('/', async (req, res) => {
  const device = await Device.findByIdOrError(req.params.id);
  const tv = device.getTelevisionCapability();
  const body = req.body;

  if (body.volume !== undefined) {
    await tv.setVolume(body.volume);
  }

  if (body.isMuted !== undefined) {
    await tv.setIsMuted(body.isMuted);
  }

  if (body.source !== undefined) {
    await tv.setCurrentSource(body.source);
  }

  res.json({ device: await mapDeviceToResponse(device) });
});

export default router;
