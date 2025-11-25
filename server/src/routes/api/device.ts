import { Device } from '../../models';
import expressAsyncWrapper from '../../helpers/express-async-wrapper';
import { DeviceApiResponse } from '../../api/types';
import { Capability } from '../../models/capabilities';

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
      capabilities: await Promise.all(device.getCapabilities().map(async (capability: Capability) => {
        switch (capability) {
          case 'LIGHT': {
            const light = await device.getLightCapability();
            
            return { 
              type: capability,
              brightness: await light.getBrightness(),
              isOn: await light.getIsOn()
            };
          }

          case 'THERMOSTAT': {
            const light = await device.getThermostatCapability();
            
            return { 
              type: capability,
              currentTemperature: await light.getCurrentTemperature(),
              
              isOn: await light.getIsOn()
            };
          }
        }
      }))
    }
  } as DeviceApiResponse)
});