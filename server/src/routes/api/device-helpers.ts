import { Device, NumericEvent, BooleanEvent } from '../../models';
import { DeviceStatus, NumericEventApiResponse, BooleanEventApiResponse, EnumEventApiResponse, RestDeviceResponse, CapabilityApiResponse } from '../../api/types';

type AwaitedObject<T> = {
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K];
};

export async function awaitPromises<T extends Record<string, unknown>>(obj: T): Promise<AwaitedObject<T>> {
  const entries = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );

  return Object.fromEntries(entries) as AwaitedObject<T>;
}

export function mapNumericEvent(eventPromise: Promise<NumericEvent | null>): Promise<NumericEventApiResponse> {
  return eventPromise.then(event => {
    if (!event) {
      throw new Error('Missing an initial event');
    }

    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: event.value
    };
  });
}

export function mapBooleanEvent(eventPromise: Promise<BooleanEvent | null>, device: Device): Promise<BooleanEventApiResponse> {
  return eventPromise.then(event => {
    // For boolean events which have never happened yet, assume they are off (since there is no "on"...)
    if (!event) {
      return {
        start: device.createdAt.toISOString(),
        end: null,
        lastReported: device.createdAt.toISOString(),
        value: false
      };
    }

    if (event.end) {
      return {
        start: event.end.toISOString(),
        end: null,
        lastReported: event.lastReported.toISOString(),
        value: false
      };
    }

    return {
      start: event.start.toISOString(),
      end: null,
      lastReported: event.lastReported.toISOString(),
      value: true
    };
  });
}

export const HEAT_PUMP_MODES: Record<number, string> = {
  0: 'STANDBY',
  1: 'HEATING',
  2: 'DHW',
  3: 'COOLING'
};

export function mapHeatPumpModeEvent(eventPromise: Promise<NumericEvent | null>): Promise<EnumEventApiResponse> {
  return eventPromise.then(event => {
    if (!event) {
      throw new Error('Missing an initial event');
    }

    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: HEAT_PUMP_MODES[event.value] ?? 'UNKNOWN'
    };
  });
}

export async function getCapabilityData(device: Device, capability: string): Promise<CapabilityApiResponse> {
  switch (capability) {
    case 'CAMERA': {
      const now = new Date().toISOString();
      return {
        type: 'CAMERA',
        snapshotUrl: {
          start: now,
          end: null,
          lastReported: now,
          value: `/api/snapshot/${device.providerId}`
        }
      };
    }

    case 'LIGHT_SENSOR': {
      const sensor = device.getLightSensorCapability();
      return awaitPromises({
        type: 'LIGHT_SENSOR' as const,
        illuminance: mapNumericEvent(sensor.getIlluminanceEvent())
      });
    }

    case 'HUMIDITY_SENSOR': {
      const sensor = device.getHumiditySensorCapability();
      return awaitPromises({
        type: 'HUMIDITY_SENSOR' as const,
        humidity: mapNumericEvent(sensor.getHumidityEvent())
      });
    }

    case 'LIGHT': {
      const light = device.getLightCapability();
      return awaitPromises({
        type: 'LIGHT' as const,
        isOn: mapBooleanEvent(light.getIsOnEvent(), device),
        brightness: mapNumericEvent(light.getBrightnessEvent())
      });
    }

    case 'HEAT_PUMP': {
      const heatPump = device.getHeatPumpCapability();
      return awaitPromises({
        type: 'HEAT_PUMP' as const,
        mode: mapHeatPumpModeEvent(heatPump.getModeEvent()),
        heatingCoP: mapNumericEvent(heatPump.getHeatingCoPEvent()),
        compressorModulation: mapNumericEvent(heatPump.getCompressorModulationEvent()),
        dhwTemperature: mapNumericEvent(heatPump.getDHWTemperatureEvent()),
        dHWCoP: mapNumericEvent(heatPump.getDHWCoPEvent()),
        outsideTemperature: mapNumericEvent(heatPump.getOutsideTemperatureEvent()),
        actualFlowTemperature: mapNumericEvent(heatPump.getActualFlowTemperatureEvent()),
        returnTemperature: mapNumericEvent(heatPump.getReturnTemperatureEvent()),
        systemPressure: mapNumericEvent(heatPump.getSystemPressureEvent()),
        dayPower: mapNumericEvent(heatPump.getDayPowerEvent()),
        dayYield: mapNumericEvent(heatPump.getDayYieldEvent()),
        dayCoP: mapNumericEvent(heatPump.getDayCoPEvent())
      });
    }

    case 'LOCK': {
      const lock = device.getLockCapability();
      return awaitPromises({
        type: 'LOCK' as const,
        isLocked: mapBooleanEvent(lock.getIsLockedEvent(), device)
      });
    }

    case 'MOTION_SENSOR': {
      const sensor = device.getMotionSensorCapability();
      return awaitPromises({
        type: 'MOTION_SENSOR' as const,
        hasMotion: mapBooleanEvent(sensor.getHasMotionEvent(), device)
      });
    }

    case 'TEMPERATURE_SENSOR': {
      const sensor = device.getTemperatureSensorCapability();
      return awaitPromises({
        type: 'TEMPERATURE_SENSOR' as const,
        currentTemperature: mapNumericEvent(sensor.getCurrentTemperatureEvent())
      });
    }

    case 'THERMOSTAT': {
      const thermostat = device.getThermostatCapability();
      return awaitPromises({
        type: 'THERMOSTAT' as const,
        targetTemperature: mapNumericEvent(thermostat.getTargetTemperatureEvent()),
        currentTemperature: mapNumericEvent(thermostat.getCurrentTemperatureEvent()),
        isHeating: mapBooleanEvent(thermostat.getIsOnEvent(), device),
        power: mapNumericEvent(thermostat.getPowerEvent())
      });
    }

    case 'SPEAKER':
      return { type: 'SPEAKER' };

    case 'SWITCH': {
      const switchCapability = device.getSwitchCapability();
      return awaitPromises({
        type: 'SWITCH' as const,
        isOn: mapBooleanEvent(switchCapability.getIsOnEvent(), device)
      });
    }

    case 'BATTERY_LEVEL_INDICATOR': {
      const battery = device.getBatteryLevelIndicatorCapability();
      return awaitPromises({
        type: 'BATTERY_LEVEL_INDICATOR' as const,
        batteryPercentage: mapNumericEvent(battery.getBatteryPercentageEvent())
      });
    }

    case 'BATTERY_LOW_INDICATOR': {
      const battery = device.getBatteryLowIndicatorCapability();
      return awaitPromises({
        type: 'BATTERY_LOW_INDICATOR' as const,
        isLow: mapBooleanEvent(battery.getIsBatteryLowEvent(), device)
      });
    }

    case 'ELECTRIC_VEHICLE': {
      const ev = device.getElectricVehicleCapability();
      return awaitPromises({
        type: 'ELECTRIC_VEHICLE' as const,
        chargePercentage: mapNumericEvent(ev.getChargePercentageEvent()),
        isCharging: mapBooleanEvent(ev.getIsChargingEvent(), device),
        chargeLimit: mapNumericEvent(ev.getChargeLimitEvent()),
        odometer: mapNumericEvent(ev.getOdometerEvent()),
        chargeSchedule: Promise.resolve((device.meta.chargeSchedule as { targetPercentage: number; targetTime: string } | undefined) ?? null)
      });
    }

    default:
      return { type: null };
  }
}

function getLastSeenFromCapabilities(capabilities: CapabilityApiResponse[], fallback: Date): string {
  let latestDate: string = fallback.toISOString();

  for (const capability of capabilities) {
    for (const value of Object.values(capability)) {
      if (typeof value === 'object' && 'lastReported' in value && latestDate < value.lastReported) {
        latestDate = value.lastReported;
      }
    }
  }

  return latestDate;
}

export async function mapDeviceToResponse(device: Device): Promise<RestDeviceResponse> {
  const isConnected = await device.getIsConnected();

  const capabilities = device.getCapabilities();
  const capabilityData = await Promise.all(
    capabilities.map(cap => getCapabilityData(device, cap))
  );

  const lastSeen = getLastSeenFromCapabilities(capabilityData, device.createdAt);

  return {
    id: device.id,
    name: device.name,
    manufacturer: device.manufacturer,
    model: device.model,
    provider: device.provider,
    providerId: device.providerId,
    roomId: device.roomId,
    status: (isConnected ? 'OK' : 'OFFLINE') as DeviceStatus,
    lastSeen,
    capabilities: capabilityData
  };
}
