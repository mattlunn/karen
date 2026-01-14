import { Device, NumericEvent, BooleanEvent } from '../../models';
import expressAsyncWrapper from '../../helpers/express-async-wrapper';
import { Capability } from '../../models/capabilities';
import { DeviceApiResponse, NumericEventApiResponse, BooleanEventApiResponse } from '../../api/types';

type AwaitedObject<T> = {
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K];
};

async function awaitPromises<T extends Record<string, unknown>>(obj: T): Promise<AwaitedObject<T>> {
  const entries = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );

  return Object.fromEntries(entries) as AwaitedObject<T>;
}

function mapNumericEvent(eventsPromise: Promise<NumericEvent[]>): Promise<NumericEventApiResponse | null> {
  return eventsPromise.then(events => {
    const event = events[0];
    if (!event) return null;
    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: event.value
    };
  });
}

function mapBooleanEvent(eventsPromise: Promise<BooleanEvent[]>): Promise<BooleanEventApiResponse | null> {
  return eventsPromise.then(events => {
    const event = events[0];
    if (!event) return null;
    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: true
    };
  });
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
              isOn: mapBooleanEvent(thermostat.getIsOnHistory(currentSelector))
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
              dHWCoP: mapNumericEvent(heatPump.getDHWCoPHistory(currentSelector)),
              heatingCoP: mapNumericEvent(heatPump.getHeatingCoPHistory(currentSelector)),
              totalDailyYield: mapNumericEvent(heatPump.getDailyConsumedEnergyHistory(currentSelector)),
              outsideTemperature: mapNumericEvent(heatPump.getOutsideTemperatureHistory(currentSelector)),
              dHWTemperature: mapNumericEvent(heatPump.getDHWTemperatureHistory(currentSelector)),
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
