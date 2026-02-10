import express from 'express';
import asyncWrapper from '../../../helpers/express-async-wrapper';
import { Device } from '../../../models';
import { VehicleUpdateRequest, DeviceApiResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse, VehicleUpdateRequest>('/', asyncWrapper(async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    res.status(404).json({ error: 'Device not found' } as any);
    return;
  }

  const ev = device.getElectricVehicleCapability();
  if (!ev) {
    res.status(400).json({ error: 'Device does not have electric vehicle capability' } as any);
    return;
  }

  const body = req.body;

  if ('chargeLimit' in body && typeof body.chargeLimit === 'number') {
    await ev.setChargeLimit(body.chargeLimit);
  }

  if ('chargeSchedule' in body) {
    device.meta.chargeSchedule = body.chargeSchedule;
    await device.save();
  }

  const deviceResponse = await mapDeviceToResponse(device);

  const response: DeviceApiResponse = {
    device: deviceResponse
  };

  res.json(response);
}));

export default router;
