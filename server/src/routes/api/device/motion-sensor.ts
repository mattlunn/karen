import express from 'express';
import asyncWrapper from '../../../helpers/express-async-wrapper';
import { Device } from '../../../models';
import { MotionSensorUpdateRequest, DeviceApiResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse, MotionSensorUpdateRequest>('/', asyncWrapper(async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const motionSensor = device.getMotionSensorCapability();
  if (!motionSensor) {
    res.status(400).json({ error: 'Device does not have motion sensor capability' });
    return;
  }

  await motionSensor.setSensitivity(req.body.sensitivity);

  const deviceResponse = await mapDeviceToResponse(device);

  const response: DeviceApiResponse = {
    device: deviceResponse
  };

  res.json(response);
}));

export default router;
