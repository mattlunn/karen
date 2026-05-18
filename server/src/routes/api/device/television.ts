import express from 'express';
import { Device } from '../../../models';
import { TelevisionUpdateRequest, DeviceApiResponse, ApiErrorResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse | ApiErrorResponse, TelevisionUpdateRequest>('/', async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  if (!device.getCapabilities().includes('TELEVISION')) {
    res.status(400).json({ error: 'Device does not have television capability' });
    return;
  }

  const tv = device.getTelevisionCapability();
  const body = req.body;

  if (body.volume !== undefined) {
    await tv.setVolume(body.volume);
  }

  if (body.isMuted !== undefined) {
    await tv.setIsMuted(body.isMuted);
  }

  if (body.source !== undefined) {
    try {
      await tv.setCurrentSource(body.source);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(400).json({ error: message });
      return;
    }
  }

  res.json({ device: await mapDeviceToResponse(device) });
});

export default router;
