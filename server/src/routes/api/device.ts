import { Device } from '../../models';
import expressAsyncWrapper from '../../helpers/express-async-wrapper';
import { Capability } from '../../models/capabilities';
import { DeviceApiResponse } from '../../api/types';

export default expressAsyncWrapper(async function (req, res, next) {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return next('route');
  }

  const response: DeviceApiResponse = {
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
              type: 'LIGHT' as const,
              brightness: await light.getBrightness(),
              isOn: await light.getIsOn()
            };
          }

          case 'THERMOSTAT': {
            const thermostat = await device.getThermostatCapability();

            return {
              type: capability,
              currentTemperature: await thermostat.getCurrentTemperature(),
              targetTemperature: await thermostat.getTargetTemperature(),
              power: await thermostat.getPower(),
              isOn: await thermostat.getIsOn()
            };
          }

          case 'HUMIDITY_SENSOR': {
            const sensor = await device.getHumiditySensorCapability();

            return {
              type: capability,
              humidity: await sensor.getHumidity()
            };
          }

          case 'TEMPERATURE_SENSOR': {
            const sensor = await device.getTemperatureSensorCapability();

            return {
              type: capability,
              currentTemperature: await sensor.getCurrentTemperature()
            };
          }

          case 'LIGHT_SENSOR': {
            const sensor = await device.getLightSensorCapability();

            return {
              type: capability,
              illuminance: await sensor.getIlluminance()
            };
          }

          case 'MOTION_SENSOR': {
            const sensor = await device.getMotionSensorCapability();

            return {
              type: capability,
              hasMotion: await sensor.getHasMotion()
            };
          }

          case 'HEAT_PUMP': {
            const heatPump = await device.getHeatPumpCapability();

            return {
              type: 'HEAT_PUMP' as const,
              dHWCoP: await heatPump.getDHWCoP(),
              heatingCoP: await heatPump.getHeatingCoP(),
              totalDailyYield: await heatPump.getDailyConsumedEnergy(),
              outsideTemperature: await heatPump.getOutsideTemperature(),
              dHWTemperature: await heatPump.getDHWTemperature(),
              actualFlowTemperature: await heatPump.getActualFlowTemperature(),
              returnTemperature: await heatPump.getReturnTemperature(),
              systemPressure: await heatPump.getSystemPressure()
            };
          }

          default: {
            return { type: null };
          }
        }
      }))
    }
  };

  res.json(response);
});
