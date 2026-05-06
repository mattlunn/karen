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

  if ('chargeScheduleOverride' in body) {
    if (body.chargeScheduleOverride !== null) {
      const targetTime = dayjs(body.chargeScheduleOverride!.targetTime);

      if (!targetTime.isValid() || !targetTime.isAfter(dayjs())) {
        res.status(400).json({ error: 'chargeScheduleOverride.targetTime must be a valid future timestamp' } as any);
        return;
      }
    }

    device.meta.chargeScheduleOverride = body.chargeScheduleOverride;
    device.meta.chargeSchedule = undefined;
    await device.save();
  }

  const deviceResponse = await mapDeviceToResponse(device);

  const response: DeviceApiResponse = {
    device: deviceResponse
  };

  res.json(response);
});

export default router;
