import { Device, NumericEvent, BooleanEvent, StringEvent } from '../../models';
import { NumericStateApiResponse, BooleanStateApiResponse, EnumStateApiResponse, RestDeviceResponse, CapabilityApiResponse, CapabilityApiResponseBase } from '../../api/types';
import dayjs from '../../dayjs';
import { awaitPromises } from '../../helpers/promises';

export function mapNumericState(eventPromise: Promise<NumericEvent | null>, device: Device): Promise<NumericStateApiResponse> {
  return eventPromise.then(event => {
    if (!event) {
      const createdAt = device.createdAt.toISOString();
      return { start: createdAt, end: null, lastReported: createdAt, value: null };
    }

    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: event.value
    };
  });
}

export function mapBooleanState(eventPromise: Promise<BooleanEvent | null>, device: Device): Promise<BooleanStateApiResponse> {
  return eventPromise.then(event => {
    if (!event) {
      const createdAt = device.createdAt.toISOString();
      return { start: createdAt, end: null, lastReported: createdAt, value: null };
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

export function mapStringState(eventPromise: Promise<StringEvent | null>, device: Device): Promise<EnumStateApiResponse> {
  return eventPromise.then(event => {
    if (!event) {
      const createdAt = device.createdAt.toISOString();
      return { start: createdAt, end: null, lastReported: createdAt, value: null };
    }

    return {
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: event.value
    };
  });
}

export async function getCapabilityData(device: Device, capability: string, instanceId: string | null = null): Promise<CapabilityApiResponseBase> {
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
      const sensor = device.getLightSensorCapability(instanceId);
      return awaitPromises({
        type: 'LIGHT_SENSOR' as const,
        illuminance: mapNumericState(sensor.getIlluminanceEvent(), device)
      });
    }

    case 'HUMIDITY_SENSOR': {
      const sensor = device.getHumiditySensorCapability(instanceId);
      return awaitPromises({
        type: 'HUMIDITY_SENSOR' as const,
        humidity: mapNumericState(sensor.getHumidityEvent(), device)
      });
    }

    case 'LIGHT': {
      const light = device.getLightCapability(instanceId);
      return awaitPromises({
        type: 'LIGHT' as const,
        isOn: mapBooleanState(light.getIsOnEvent(), device),
        brightness: mapNumericState(light.getBrightnessEvent(), device)
      });
    }

    case 'HEAT_PUMP': {
      const heatPump = device.getHeatPumpCapability(instanceId);
      return awaitPromises({
        type: 'HEAT_PUMP' as const,
        mode: mapStringState(heatPump.getModeEvent(), device),
        compressorModulation: mapNumericState(heatPump.getCompressorModulationEvent(), device),
        dhwTemperature: mapNumericState(heatPump.getDHWTemperatureEvent(), device),
        outsideTemperature: mapNumericState(heatPump.getOutsideTemperatureEvent(), device),
        actualFlowTemperature: mapNumericState(heatPump.getActualFlowTemperatureEvent(), device),
        returnTemperature: mapNumericState(heatPump.getReturnTemperatureEvent(), device),
        systemPressure: mapNumericState(heatPump.getSystemPressureEvent(), device),
        dayPower: mapNumericState(heatPump.getDayPowerEvent(), device),
        dayYield: mapNumericState(heatPump.getDayYieldEvent(), device),
        dayCoP: mapNumericState(heatPump.getDayCoPEvent(), device)
      });
    }

    case 'LOCK': {
      const lock = device.getLockCapability(instanceId);
      return awaitPromises({
        type: 'LOCK' as const,
        isLocked: mapBooleanState(lock.getIsLockedEvent(), device)
      });
    }

    case 'MOTION_SENSOR': {
      const sensor = device.getMotionSensorCapability(instanceId);
      return awaitPromises({
        type: 'MOTION_SENSOR' as const,
        hasMotion: mapBooleanState(sensor.getHasMotionEvent(), device)
      });
    }

    case 'MOTION_SENSOR_SENSITIVITY': {
      const sensor = device.getMotionSensorSensitivityCapability(instanceId);
      return awaitPromises({
        type: 'MOTION_SENSOR_SENSITIVITY' as const,
        sensitivity: mapNumericState(sensor.getSensitivityEvent(), device),
        pendingSensitivity: sensor.getPendingSensitivity()
      });
    }

    case 'TEMPERATURE_SENSOR': {
      const sensor = device.getTemperatureSensorCapability(instanceId);
      return awaitPromises({
        type: 'TEMPERATURE_SENSOR' as const,
        currentTemperature: mapNumericState(sensor.getCurrentTemperatureEvent(), device)
      });
    }

    case 'THERMOSTAT': {
      const thermostat = device.getThermostatCapability(instanceId);
      return awaitPromises({
        type: 'THERMOSTAT' as const,
        targetTemperature: mapNumericState(thermostat.getTargetTemperatureEvent(), device),
        currentTemperature: mapNumericState(thermostat.getCurrentTemperatureEvent(), device),
        isHeating: mapBooleanState(thermostat.getIsOnEvent(), device),
        power: mapNumericState(thermostat.getPowerEvent(), device),
        isPassive: mapBooleanState(thermostat.getIsPassiveEvent(), device)
      });
    }

    case 'BUTTON': {
      const button = device.getButtonCapability(instanceId);
      const now = new Date();
      const startOfToday = dayjs().startOf('day').toDate();

      const [pressedEvent, pressedHistory] = await Promise.all([
        button.getPressedEvent(),
        button.getPressedHistory({ since: device.createdAt, until: now }),
      ]);

      const totalPresses = pressedHistory.length;
      const pressesToday = pressedHistory.filter(event => event.start >= startOfToday).length;

      return {
        type: 'BUTTON',
        lastPressed: pressedEvent ? {
          start: pressedEvent.start.toISOString(),
          end: pressedEvent.end!.toISOString(),
          lastReported: pressedEvent.lastReported.toISOString(),
          value: Boolean(pressedEvent.value),
        } : null,
        pressesToday,
        totalPresses,
      };
    }

    case 'SPEAKER':
      return { type: 'SPEAKER' };

    case 'SWITCH': {
      const switchCapability = device.getSwitchCapability(instanceId);
      return awaitPromises({
        type: 'SWITCH' as const,
        isOn: mapBooleanState(switchCapability.getIsOnEvent(), device)
      });
    }

    case 'TELEVISION': {
      const tv = device.getTelevisionCapability(instanceId);
      return awaitPromises({
        type: 'TELEVISION' as const,
        volume: mapNumericState(tv.getVolumeEvent(), device),
        isMuted: mapBooleanState(tv.getIsMutedEvent(), device),
        availableSources: tv.getAvailableSources(),
      });
    }

    case 'BATTERY_LEVEL_INDICATOR': {
      const battery = device.getBatteryLevelIndicatorCapability(instanceId);
      return awaitPromises({
        type: 'BATTERY_LEVEL_INDICATOR' as const,
        batteryPercentage: mapNumericState(battery.getBatteryPercentageEvent(), device)
      });
    }

    case 'BATTERY_LOW_INDICATOR': {
      const battery = device.getBatteryLowIndicatorCapability(instanceId);
      return awaitPromises({
        type: 'BATTERY_LOW_INDICATOR' as const,
        isLow: mapBooleanState(battery.getIsBatteryLowEvent(), device)
      });
    }

    case 'ALARM_SENSOR': {
      const sensor = device.getAlarmSensorCapability(instanceId);
      const event = await sensor.getIsTriggeredEvent();

      return {
        type: 'ALARM_SENSOR' as const,
        isTriggered: await mapBooleanState(Promise.resolve(event), device),
        lastTriggered: event ? {
          start: event.start.toISOString(),
          end: event.end?.toISOString() ?? null,
          durationSeconds: event.end
            ? Math.round((event.end.getTime() - event.start.getTime()) / 1000)
            : null
        } : null
      };
    }

    case 'CONTACT_SENSOR': {
      const sensor = device.getContactSensorCapability(instanceId);
      return awaitPromises({
        type: 'CONTACT_SENSOR' as const,
        isOpen: mapBooleanState(sensor.getIsOpenEvent(), device)
      });
    }

    case 'BIN_COLLECTION': {
      const cap = device.getBinCollectionCapability(instanceId);
      const schedule = cap.getScheduleData();
      const next = cap.getNextCollectionDate();

      return {
        type: 'BIN_COLLECTION' as const,
        color: cap.getColor(),
        ...schedule,
        nextCollection: { date: dayjs(next.date).format('YYYY-MM-DD'), isOverride: next.isOverride },
      };
    }

    case 'ELECTRIC_VEHICLE': {
      const ev = device.getElectricVehicleCapability(instanceId);

      return awaitPromises({
        type: 'ELECTRIC_VEHICLE' as const,
        chargePercentage: mapNumericState(ev.getChargePercentageEvent(), device),
        isCharging: mapBooleanState(ev.getIsChargingEvent(), device),
        isCableConnected: mapBooleanState(ev.getIsCableConnectedEvent(), device),
        chargeLimit: mapNumericState(ev.getChargeLimitEvent(), device),
        odometer: mapNumericState(ev.getOdometerEvent(), device),
        chargeSchedule: ev.getNextChargeSchedule(),
      });
    }

    case 'CONNECTIVITY': {
      const conn = device.getConnectivityCapability(instanceId);
      return awaitPromises({
        type: 'CONNECTIVITY' as const,
        isConnected: mapBooleanState(conn.getIsConnectedEvent(), device)
      });
    }

    case 'ENERGY_MONITOR': {
      const energyMonitor = device.getEnergyMonitorCapability(instanceId);
      return awaitPromises({
        type: 'ENERGY_MONITOR' as const,
        currentPower: mapNumericState(energyMonitor.getCurrentPowerEvent(), device),
        dayEnergy: mapNumericState(energyMonitor.getDayEnergyEvent(), device),
        dayCost: mapNumericState(energyMonitor.getDayCostEvent(), device)
      });
    }

    case 'ENERGY_COST': {
      const energyCost = device.getEnergyCostCapability(instanceId);
      return awaitPromises({
        type: 'ENERGY_COST' as const,
        unitRate: mapNumericState(energyCost.getUnitRateEvent(), device),
        standingCharge: mapNumericState(energyCost.getStandingChargeEvent(), device)
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
      if (typeof value === 'object' && value !== null && 'lastReported' in value && latestDate < value.lastReported) {
        latestDate = value.lastReported;
      }
    }
  }

  return latestDate;
}

export async function mapDeviceToResponse(device: Device): Promise<RestDeviceResponse> {
  const capabilities = device.getCapabilities();
  const capabilityData = await Promise.all(
    capabilities.flatMap(cap => device.getCapabilityInstances(cap).map(async (instance) => ({
      ...await getCapabilityData(device, cap, instance.id),
      instanceId: instance.id,
      instanceName: instance.name
    })))
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
    lastSeen,
    capabilities: capabilityData
  };
}
