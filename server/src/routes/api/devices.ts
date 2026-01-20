import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Device, Room, NumericEvent, BooleanEvent } from '../../models';
import { Capability } from '../../models/capabilities';
import {
  CapabilityApiResponse,
  RestDeviceResponse,
  HomeRoom,
  DevicesApiResponse,
  NumericEventApiResponse,
  BooleanEventApiResponse,
  EnumEventApiResponse
} from '../../api/types';

const router = express.Router();

type AwaitedObject<T> = {
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K];
};

async function awaitPromises<T extends Record<string, unknown>>(obj: T): Promise<AwaitedObject<T>> {
  const entries = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );

  return Object.fromEntries(entries) as AwaitedObject<T>;
}

function mapNumericEvent(eventsPromise: Promise<NumericEvent[]>): Promise<NumericEventApiResponse> {
  return eventsPromise.then(events => {
    const event = events[0];

    if (!event) {
      throw new Error('Missing an initial event');
    }

    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: event.value
    };
  });
}

function mapBooleanEvent(eventsPromise: Promise<BooleanEvent[]>): Promise<BooleanEventApiResponse> {
  return eventsPromise.then(events => {
    const event = events[0];

    if (!event) {
      throw new Error('Missing an initial event');
    }

    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: true
    };
  });
}

const HEAT_PUMP_MODES: Record<number, string> = {
  0: 'STANDBY',
  1: 'HEATING',
  2: 'DHW',
  3: 'COOLING'
};

function mapHeatPumpModeEvent(eventsPromise: Promise<NumericEvent[]>): Promise<EnumEventApiResponse> {
  return eventsPromise.then(events => {
    const event = events[0];

    if (!event) {
      throw new Error('Missing an initial event');
    }

    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      value: HEAT_PUMP_MODES[event.value] ?? 'UNKNOWN'
    };
  });
}

const currentSelector = { limit: 1, until: new Date() };

async function getCapabilityData(device: Device, capability: Capability): Promise<CapabilityApiResponse> {
  switch (capability) {
    case 'CAMERA': {
      const now = new Date().toISOString();
      return {
        type: 'CAMERA',
        snapshotUrl: {
          start: now,
          end: null,
          value: `/api/snapshot/${device.providerId}`
        }
      };
    }

    case 'LIGHT_SENSOR': {
      const sensor = device.getLightSensorCapability();
      return awaitPromises({
        type: 'LIGHT_SENSOR' as const,
        illuminance: mapNumericEvent(sensor.getIlluminanceHistory(currentSelector))
      });
    }

    case 'HUMIDITY_SENSOR': {
      const sensor = device.getHumiditySensorCapability();
      return awaitPromises({
        type: 'HUMIDITY_SENSOR' as const,
        humidity: mapNumericEvent(sensor.getHumidityHistory(currentSelector))
      });
    }

    case 'LIGHT': {
      const light = device.getLightCapability();
      return awaitPromises({
        type: 'LIGHT' as const,
        isOn: mapBooleanEvent(light.getIsOnHistory(currentSelector)),
        brightness: mapNumericEvent(light.getBrightnessHistory(currentSelector))
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

    case 'LOCK': {
      const lock = device.getLockCapability();
      return awaitPromises({
        type: 'LOCK' as const,
        isLocked: mapBooleanEvent(lock.getIsLockedHistory(currentSelector))
      });
    }

    case 'MOTION_SENSOR': {
      const sensor = device.getMotionSensorCapability();
      return awaitPromises({
        type: 'MOTION_SENSOR' as const,
        hasMotion: mapBooleanEvent(sensor.getHasMotionHistory(currentSelector))
      });
    }

    case 'TEMPERATURE_SENSOR': {
      const sensor = device.getTemperatureSensorCapability();
      return awaitPromises({
        type: 'TEMPERATURE_SENSOR' as const,
        currentTemperature: mapNumericEvent(sensor.getCurrentTemperatureHistory(currentSelector))
      });
    }

    case 'THERMOSTAT': {
      const thermostat = device.getThermostatCapability();
      return awaitPromises({
        type: 'THERMOSTAT' as const,
        targetTemperature: mapNumericEvent(thermostat.getTargetTemperatureHistory(currentSelector)),
        currentTemperature: mapNumericEvent(thermostat.getCurrentTemperatureHistory(currentSelector)),
        isHeating: mapBooleanEvent(thermostat.getIsOnHistory(currentSelector)),
        power: mapNumericEvent(thermostat.getPowerHistory(currentSelector))
      });
    }

    case 'SPEAKER':
      return { type: 'SPEAKER' };

    case 'SWITCH': {
      const switchCapability = device.getSwitchCapability();
      return awaitPromises({
        type: 'SWITCH' as const,
        isOn: mapBooleanEvent(switchCapability.getIsOnHistory(currentSelector))
      });
    }

    case 'BATTERY_LEVEL_INDICATOR': {
      const battery = device.getBatteryLevelIndicatorCapability();
      return awaitPromises({
        type: 'BATTERY_LEVEL_INDICATOR' as const,
        batteryPercentage: mapNumericEvent(battery.getBatteryPercentageHistory(currentSelector))
      });
    }

    case 'BATTERY_LOW_INDICATOR': {
      const battery = device.getBatteryLowIndicatorCapability();
      return awaitPromises({
        type: 'BATTERY_LOW_INDICATOR' as const,
        isLow: mapBooleanEvent(battery.getIsBatteryLowHistory(currentSelector))
      });
    }

    default:
      return { type: null };
  }
}

router.get<Record<string, never>, DevicesApiResponse>('/', asyncWrapper(async (req, res) => {
  const [allDevices, allRooms] = await Promise.all([
    Device.findAll(),
    Room.findAll()
  ]);

  const rooms: HomeRoom[] = allRooms
    .sort((a, b) => ((a.displayWeight as number | null) ?? 0) - ((b.displayWeight as number | null) ?? 0))
    .map(room => ({
      id: room.id as number,
      name: room.name,
      displayIconName: room.displayIconName as string | null,
      displayWeight: room.displayWeight as number | null
    }));

  const devices: RestDeviceResponse[] = await Promise.all(
    allDevices.map(async device => {
      const capabilities = device.getCapabilities();
      const [capabilityData, isConnected] = await Promise.all([
        Promise.all(capabilities.map(cap => getCapabilityData(device, cap))),
        device.getIsConnected()
      ]);

      return {
        id: device.id,
        name: device.name,
        roomId: device.roomId,
        status: isConnected ? 'OK' : 'OFFLINE',
        capabilities: capabilityData
      };
    })
  );

  res.json({
    rooms,
    devices
  });
}));

export default router;
