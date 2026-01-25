import { Device } from '../../models';
import expressAsyncWrapper from '../../helpers/express-async-wrapper';
import { DeviceApiResponse } from '../../api/types';
import { mapDeviceToResponse } from './device-helpers';

export default expressAsyncWrapper(async function (req, res, next) {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return next('route');
  }

  const deviceResponse = await mapDeviceToResponse(device);

  const response: DeviceApiResponse = {
    device: deviceResponse
  };

  res.json(response);
});
