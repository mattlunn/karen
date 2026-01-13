import { Device, NumericEvent, BooleanEvent } from '../../models';
import expressAsyncWrapper from '../../helpers/express-async-wrapper';
import { Capability } from '../../models/capabilities';
import { DeviceApiResponse, NumericEventApiResponse, BooleanEventApiResponse } from '../../api/types';

function mapNumericEvent(events: NumericEvent[]): NumericEventApiResponse | null {
  const event = events[0];
  if (!event) return null;
  return {
    start: event.start.toISOString(),
    end: event.end?.toISOString() ?? null,
    value: event.value
  };
}

function mapBooleanEvent(events: BooleanEvent[]): BooleanEventApiResponse | null {
  const event = events[0];
  if (!event) return null;
  return {
    start: event.start.toISOString(),
    end: event.end?.toISOString() ?? null,
    value: true
  };
}

export default expressAsyncWrapper(async function (req, res, next) {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return next('route');
  }

  const currentSelector = { limit: 1, until: new Date() };

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

            return {
              type: 'LIGHT' as const,
              brightness: mapNumericEvent(await light.getBrightnessHistory(currentSelector)),
              isOn: mapBooleanEvent(await light.getIsOnHistory(currentSelector))
            };
          }

          case 'THERMOSTAT': {
            const thermostat = device.getThermostatCapability();

            return {
              type: capability,
              currentTemperature: mapNumericEvent(await thermostat.getCurrentTemperatureHistory(currentSelector)),
              targetTemperature: mapNumericEvent(await thermostat.getTargetTemperatureHistory(currentSelector)),
              power: mapNumericEvent(await thermostat.getPowerHistory(currentSelector)),
              isOn: mapBooleanEvent(await thermostat.getIsOnHistory(currentSelector))
            };
          }

          case 'HUMIDITY_SENSOR': {
            const sensor = device.getHumiditySensorCapability();

            return {
              type: capability,
              humidity: mapNumericEvent(await sensor.getHumidityHistory(currentSelector))
            };
          }

          case 'TEMPERATURE_SENSOR': {
            const sensor = device.getTemperatureSensorCapability();

            return {
              type: capability,
              currentTemperature: mapNumericEvent(await sensor.getCurrentTemperatureHistory(currentSelector))
            };
          }

          case 'LIGHT_SENSOR': {
            const sensor = device.getLightSensorCapability();

            return {
              type: capability,
              illuminance: mapNumericEvent(await sensor.getIlluminanceHistory(currentSelector))
            };
          }

          case 'MOTION_SENSOR': {
            const sensor = device.getMotionSensorCapability();

            return {
              type: capability,
              hasMotion: mapBooleanEvent(await sensor.getHasMotionHistory(currentSelector))
            };
          }

          case 'HEAT_PUMP': {
            const heatPump = device.getHeatPumpCapability();

            return {
              type: 'HEAT_PUMP' as const,
              dHWCoP: mapNumericEvent(await heatPump.getDHWCoPHistory(currentSelector)),
              heatingCoP: mapNumericEvent(await heatPump.getHeatingCoPHistory(currentSelector)),
              totalDailyYield: mapNumericEvent(await heatPump.getDailyConsumedEnergyHistory(currentSelector)),
              outsideTemperature: mapNumericEvent(await heatPump.getOutsideTemperatureHistory(currentSelector)),
              dHWTemperature: mapNumericEvent(await heatPump.getDHWTemperatureHistory(currentSelector)),
              actualFlowTemperature: mapNumericEvent(await heatPump.getActualFlowTemperatureHistory(currentSelector)),
              returnTemperature: mapNumericEvent(await heatPump.getReturnTemperatureHistory(currentSelector)),
              systemPressure: mapNumericEvent(await heatPump.getSystemPressureHistory(currentSelector))
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
