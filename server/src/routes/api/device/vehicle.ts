import express from 'express';
import { Device } from '../../../models';
import { VehicleUpdateRequest, DeviceApiResponse } from '../../../api/types';
import { mapDeviceToResponse } from '../device-helpers';
import dayjs from '../../../dayjs';

const router = express.Router({ mergeParams: true });

router.put<Record<string, never>, DeviceApiResponse, VehicleUpdateRequest>('/', async (req, res) => {
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

  if ('manualChargeSchedule' in body) {
    if (body.manualChargeSchedule !== null) {
      const targetTime = dayjs(body.manualChargeSchedule!.targetTime);

      if (!targetTime.isValid() || !targetTime.isAfter(dayjs())) {
        res.status(400).json({ error: 'manualChargeSchedule.targetTime must be a valid future timestamp' } as any);
        return;
      }
    }

    await ev.setManualChargeSchedule(body.manualChargeSchedule ?? null);
  }

  const deviceResponse = await mapDeviceToResponse(device);

  const response: DeviceApiResponse = {
    device: deviceResponse
  };

  res.json(response);
});

export default router;
