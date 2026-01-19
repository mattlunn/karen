import express from 'express';
import asyncWrapper from '../../../helpers/express-async-wrapper';
import { Device } from '../../../models';
import { LockUpdateRequest, LockResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put('/', asyncWrapper(async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const lock = device.getLockCapability();
  if (!lock) {
    res.status(400).json({ error: 'Device does not have lock capability' });
    return;
  }

  const body = req.body as LockUpdateRequest;

  if ('isLocked' in body) {
    await lock.setIsLocked(body.isLocked);
  }

  const [isLocked, isConnected] = await Promise.all([
    lock.getIsLocked(),
    device.getIsConnected()
  ]);

  const response: LockResponse = mapDeviceToResponse(device, isConnected, {
    lock: {
      isLocked
    }
  });

  res.json(response);
}));

export default router;
