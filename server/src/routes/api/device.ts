import { BooleanEvent, Device, NumericEvent } from '../../models';
import expressAsyncWrapper from '../../helpers/express-async-wrapper';
import { Capability } from '../../models/capabilities';
import moment from 'moment';
import { BooleanEventApiResponse, DeviceApiResponse, NumericEventApiResponse } from '../../api/types';
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

            return {
              type: 'LIGHT',
              isOnHistory: await mapBooleanHistoryToResponse((hs) => light.getIsOnHistory(hs), historySelector),
              brightnessHistory: await mapNumericHistoryToResponse((hs) => light.getBrightnessHistory(hs), historySelector)
            };
          };

          case 'THERMOSTAT': {
            const thermostat = await device.getThermostatCapability();
            
            return { 
              type: capability,
              currentTemperatureHistory: await mapNumericHistoryToResponse((hs) => thermostat.getCurrentTemperatureHistory(hs), historySelector),
              targetTemperatureHistory: await mapNumericHistoryToResponse((hs) => thermostat.getTargetTemperatureHistory(hs), historySelector),
              powerHistory: await mapNumericHistoryToResponse((hs) => thermostat.getPowerHistory(hs), historySelector),
              isOnHistory: await mapBooleanHistoryToResponse((hs) => thermostat.getIsOnHistory(hs), historySelector),
            };
          }

          case 'HUMIDITY_SENSOR': {
            const sensor = await device.getHumiditySensorCapability();
            
            return { 
              type: capability,
              humidityHistory: await mapNumericHistoryToResponse((hs) => sensor.getHumidityHistory(hs), historySelector),
            };
          }

          case 'TEMPERATURE_SENSOR': {
            const sensor = await device.getTemperatureSensorCapability();
            
            return { 
              type: capability,
              currentTemperatureHistory: await mapNumericHistoryToResponse((hs) => sensor.getCurrentTemperatureHistory(hs), historySelector),
            };
          }

          case 'LIGHT_SENSOR': {
            const sensor = await device.getLightSensorCapability();
            
            return { 
              type: capability,
              illuminanceHistory: await mapNumericHistoryToResponse((hs) => sensor.getIlluminanceHistory(hs), historySelector),
            };
          }

          case 'MOTION_SENSOR': {
            const sensor = await device.getMotionSensorCapability();
            
            return { 
              type: capability,
              hasMotionHistory: await mapBooleanHistoryToResponse((hs) => sensor.getHasMotionHistory(hs), historySelector),
            };
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
