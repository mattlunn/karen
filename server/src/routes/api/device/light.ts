import express from 'express';
import asyncWrapper from '../../../helpers/express-async-wrapper';
import { Device } from '../../../models';
import { LightUpdateRequest, LightResponse } from '../../../api/types';

const router = express.Router({ mergeParams: true });

router.put('/', asyncWrapper(async (req, res) => {
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

  const body = req.body as LightUpdateRequest;

  if ('brightness' in body && body.brightness !== undefined) {
    await light.setBrightness(body.brightness);
  } else if ('isOn' in body && body.isOn !== undefined) {
    await light.setIsOn(body.isOn);
  }

  const [isOn, brightness, isConnected] = await Promise.all([
    light.getIsOn(),
    light.getBrightness(),
    device.getIsConnected()
  ]);

  const response: LightResponse = {
    id: device.id,
    name: device.name,
    status: isConnected ? 'OK' : 'OFFLINE',
    light: {
      isOn,
      brightness
    }
  };

  res.json(response);
}));

export default router;
