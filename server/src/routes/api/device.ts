import { Device } from '../../models';
import expressAsyncWrapper from '../../helpers/express-async-wrapper';

export default expressAsyncWrapper(async function (req, res, next) {
  const device = await Device.findById(req.params.id);
  
  if (!device) {
    return next('route');
  }

  res.json({
    device: {
      id: device.id,
      name: device.name,
      type: device.type,
      provider: device.provider,
      providerId: device.providerId,
    }
  })
});