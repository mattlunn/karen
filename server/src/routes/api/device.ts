import { Device } from '../../models';
import { Request, Response, NextFunction } from 'express';
import { DeviceApiResponse } from '../../api/types';
import { mapDeviceToResponse } from './device-helpers';

export default async function (req: Request, res: Response, next: NextFunction) {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return next('route');
  }

  const deviceResponse = await mapDeviceToResponse(device);

  const response: DeviceApiResponse = {
    device: deviceResponse
  };

  res.json(response);
}
