import express from 'express';
import asyncWrapper from '../../../helpers/express-async-wrapper';
import { Device } from '../../../models';
import { LightUpdateRequest } from '../../../api/types';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, void, LightUpdateRequest>('/', asyncWrapper(async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const light = device.getLightCapability();
  if (!light) {
    res.status(400).json({ error: 'Device does not have light capability' });
    return;
  }

  const body = req.body;

  if ('brightness' in body && body.brightness !== undefined) {
    await light.setBrightness(body.brightness);
  } else if ('isOn' in body && body.isOn !== undefined) {
    await light.setIsOn(body.isOn);
  }

  res.status(204).send();
}));

export default router;
