import { Device } from '../../models';
import expressAsyncWrapper from '../../helpers/express-async-wrapper';
import { Capability } from '../../models/capabilities';
import { DeviceApiResponse } from '../../api/types';
import {
  awaitPromises,
  mapNumericEvent,
  mapBooleanEvent,
  mapHeatPumpModeEvent,
  currentSelector
} from './device-helpers';

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
            const light = device.getLightCapability();

            return awaitPromises({
              type: 'LIGHT' as const,
              brightness: mapNumericEvent(light.getBrightnessHistory(currentSelector)),
              isOn: mapBooleanEvent(light.getIsOnHistory(currentSelector))
            });
          }

          case 'THERMOSTAT': {
            const thermostat = device.getThermostatCapability();

            return awaitPromises({
              type: capability,
              currentTemperature: mapNumericEvent(thermostat.getCurrentTemperatureHistory(currentSelector)),
              targetTemperature: mapNumericEvent(thermostat.getTargetTemperatureHistory(currentSelector)),
              power: mapNumericEvent(thermostat.getPowerHistory(currentSelector)),
              isHeating: mapBooleanEvent(thermostat.getIsOnHistory(currentSelector))
            });
          }

          case 'HUMIDITY_SENSOR': {
            const sensor = device.getHumiditySensorCapability();

            return awaitPromises({
              type: capability,
              humidity: mapNumericEvent(sensor.getHumidityHistory(currentSelector))
            });
          }

          case 'TEMPERATURE_SENSOR': {
            const sensor = device.getTemperatureSensorCapability();

            return awaitPromises({
              type: capability,
              currentTemperature: mapNumericEvent(sensor.getCurrentTemperatureHistory(currentSelector))
            });
          }

          case 'LIGHT_SENSOR': {
            const sensor = device.getLightSensorCapability();

            return awaitPromises({
              type: capability,
              illuminance: mapNumericEvent(sensor.getIlluminanceHistory(currentSelector))
            });
          }

          case 'MOTION_SENSOR': {
            const sensor = device.getMotionSensorCapability();

            return awaitPromises({
              type: capability,
              hasMotion: mapBooleanEvent(sensor.getHasMotionHistory(currentSelector))
            });
          }

          case 'HEAT_PUMP': {
            const heatPump = device.getHeatPumpCapability();

            return awaitPromises({
              type: 'HEAT_PUMP' as const,
              mode: mapHeatPumpModeEvent(heatPump.getModeHistory(currentSelector)),
              dailyConsumedEnergy: mapNumericEvent(heatPump.getDailyConsumedEnergyHistory(currentSelector)),
              heatingCoP: mapNumericEvent(heatPump.getHeatingCoPHistory(currentSelector)),
              compressorModulation: mapNumericEvent(heatPump.getCompressorModulationHistory(currentSelector)),
              dhwTemperature: mapNumericEvent(heatPump.getDHWTemperatureHistory(currentSelector)),
              dHWCoP: mapNumericEvent(heatPump.getDHWCoPHistory(currentSelector)),
              outsideTemperature: mapNumericEvent(heatPump.getOutsideTemperatureHistory(currentSelector)),
              actualFlowTemperature: mapNumericEvent(heatPump.getActualFlowTemperatureHistory(currentSelector)),
              returnTemperature: mapNumericEvent(heatPump.getReturnTemperatureHistory(currentSelector)),
              systemPressure: mapNumericEvent(heatPump.getSystemPressureHistory(currentSelector))
            });
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
