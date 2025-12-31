import { BooleanEvent, Device, NumericEvent } from '../../models';
import expressAsyncWrapper from '../../helpers/express-async-wrapper';
import { Capability } from '../../models/capabilities';
import moment from 'moment';
import { BooleanEventApiResponse, DeviceApiResponse, EnumEventApiResponse, NumericEventApiResponse } from '../../api/types';
import { HistorySelector } from '../../models/capabilities/helpers';

async function mapBooleanHistoryToResponse(fetchHistory: (hs: HistorySelector) => Promise<BooleanEvent[]>, historySelector: HistorySelector): Promise<BooleanEventApiResponse[]> {
  return (await fetchHistory(historySelector)).map((event: BooleanEvent) => ({
    start: event.start.toISOString(),
    end: event.end?.toISOString() ?? null,
  }));
}

async function mapNumericHistoryToResponse(fetchHistory: (hs: HistorySelector) => Promise<NumericEvent[]>, historySelector: HistorySelector): Promise<NumericEventApiResponse[]> {
  return (await fetchHistory(historySelector)).map((event: NumericEvent) => ({
    start: event.start.toISOString(),
    end: event.end?.toISOString() ?? null,
    value: event.value
  }));
}

async function mapEnumHistoryToResponse(fetchHistory: (hs: HistorySelector) => Promise<NumericEvent[]>, historySelector: HistorySelector, map: Record<number, string>): Promise<EnumEventApiResponse[]> {
  return (await fetchHistory(historySelector)).map((event: NumericEvent) => ({
    start: event.start.toISOString(),
    end: event.end?.toISOString() ?? null,
    value: map[event.value]
  }));
}

type AwaitedObject<T> = {
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K];
}

async function awaitPromises<T extends Record<string, any>>(obj: T): Promise<AwaitedObject<T>> {
  const entries = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );

  return Object.fromEntries(entries) as AwaitedObject<T>;
}

export default expressAsyncWrapper(async function (req, res, next) {
  const device = await Device.findById(req.params.id);
  const historySelector = { until: new Date(), since: moment().startOf('day').toDate() };

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

            return await awaitPromises({
              type: 'LIGHT' as const,
              isOnHistory: mapBooleanHistoryToResponse((hs) => light.getIsOnHistory(hs), historySelector),
              brightnessHistory: mapNumericHistoryToResponse((hs) => light.getBrightnessHistory(hs), historySelector)
            });
          };

          case 'THERMOSTAT': {
            const thermostat = await device.getThermostatCapability();
            
            return await awaitPromises({ 
              type: capability,
              currentTemperatureHistory: mapNumericHistoryToResponse((hs) => thermostat.getCurrentTemperatureHistory(hs), historySelector),
              targetTemperatureHistory: mapNumericHistoryToResponse((hs) => thermostat.getTargetTemperatureHistory(hs), historySelector),
              powerHistory: mapNumericHistoryToResponse((hs) => thermostat.getPowerHistory(hs), historySelector),
              isOnHistory: mapBooleanHistoryToResponse((hs) => thermostat.getIsOnHistory(hs), historySelector),
            });
          }

          case 'HUMIDITY_SENSOR': {
            const sensor = await device.getHumiditySensorCapability();
            
            return await awaitPromises({ 
              type: capability,
              humidityHistory: mapNumericHistoryToResponse((hs) => sensor.getHumidityHistory(hs), historySelector),
            });
          }

          case 'TEMPERATURE_SENSOR': {
            const sensor = await device.getTemperatureSensorCapability();
            
            return await awaitPromises({ 
              type: capability,
              currentTemperatureHistory: mapNumericHistoryToResponse((hs) => sensor.getCurrentTemperatureHistory(hs), historySelector),
            });
          }

          case 'LIGHT_SENSOR': {
            const sensor = await device.getLightSensorCapability();
            
            return await awaitPromises({ 
              type: capability,
              illuminanceHistory: mapNumericHistoryToResponse((hs) => sensor.getIlluminanceHistory(hs), historySelector),
            });
          }

          case 'MOTION_SENSOR': {
            const sensor = await device.getMotionSensorCapability();
            
            return await awaitPromises({ 
              type: capability,
              hasMotionHistory: mapBooleanHistoryToResponse((hs) => sensor.getHasMotionHistory(hs), historySelector),
            });
          }

          case 'HEAT_PUMP': {
            const heatPump = await device.getHeatPumpCapability();

            return await awaitPromises({
              type: 'HEAT_PUMP',
              dHWCoP: heatPump.getDHWCoP(),
              heatingCoP: heatPump.getHeatingCoP(),
              dHWTemperatureHistory: mapNumericHistoryToResponse((hs) => heatPump.getDHWTemperatureHistory(hs), historySelector),
              actualFlowTemperatureHistory: mapNumericHistoryToResponse((hs) => heatPump.getActualFlowTemperatureHistory(hs), historySelector),
              returnTemperatureHistory: mapNumericHistoryToResponse((hs) => heatPump.getReturnTemperatureHistory(hs), historySelector),
              powerHistory: mapNumericHistoryToResponse((hs) => heatPump.getCurrentPowerHistory(hs), historySelector),
              yieldHistory: mapNumericHistoryToResponse((hs) => heatPump.getCurrentYieldHistory(hs), historySelector),
              systemPressureHistory: mapNumericHistoryToResponse((hs) => heatPump.getSystemPressureHistory(hs), historySelector),
              totalDailyYield: heatPump.getDailyConsumedEnergy(),
              outsideTemperatureHistory: mapNumericHistoryToResponse((hs) => heatPump.getOutsideTemperatureHistory(hs), historySelector),
              modeHistory: mapEnumHistoryToResponse((hs) => heatPump.getModeHistory(hs), historySelector, {
                0: 'UNKNOWN',
                1: 'STANDBY',
                2: 'HEATING',
                3: 'DHW',
                4: 'DEICING',
                5: 'FROST_PROTECTION',
              }),
            });
          }

          default: {
            return { type: null };
          }
        }
      }))
    },

    history: {
      since: historySelector.since.toISOString(),
      until: historySelector.until.toISOString()  
    }
  };

  res.json(response);
});