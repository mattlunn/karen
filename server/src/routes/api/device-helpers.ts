import { Device, NumericEvent, BooleanEvent, StringEvent } from '../../models';
import { NumericStateApiResponse, BooleanStateApiResponse, EnumStateApiResponse, RestDeviceResponse, CapabilityApiResponse } from '../../api/types';
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
        illuminance: mapNumericState(sensor.getIlluminanceEvent(), device)
      });
    }

    case 'HUMIDITY_SENSOR': {
      const sensor = device.getHumiditySensorCapability();
      return awaitPromises({
        type: 'HUMIDITY_SENSOR' as const,
        humidity: mapNumericState(sensor.getHumidityEvent(), device)
      });
    }

    case 'LIGHT': {
      const light = device.getLightCapability();
      return awaitPromises({
        type: 'LIGHT' as const,
        isOn: mapBooleanState(light.getIsOnEvent(), device),
        brightness: mapNumericState(light.getBrightnessEvent(), device)
      });
    }

    case 'HEAT_PUMP': {
      const heatPump = device.getHeatPumpCapability();
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
      const lock = device.getLockCapability();
      return awaitPromises({
        type: 'LOCK' as const,
        isLocked: mapBooleanState(lock.getIsLockedEvent(), device)
      });
    }

    case 'MOTION_SENSOR': {
      const sensor = device.getMotionSensorCapability();
      return awaitPromises({
        type: 'MOTION_SENSOR' as const,
        hasMotion: mapBooleanState(sensor.getHasMotionEvent(), device)
      });
    }

    case 'TEMPERATURE_SENSOR': {
      const sensor = device.getTemperatureSensorCapability();
      return awaitPromises({
        type: 'TEMPERATURE_SENSOR' as const,
        currentTemperature: mapNumericState(sensor.getCurrentTemperatureEvent(), device)
      });
    }

    case 'THERMOSTAT': {
      const thermostat = device.getThermostatCapability();
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
      const button = device.getButtonCapability();
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
      const switchCapability = device.getSwitchCapability();
      return awaitPromises({
        type: 'SWITCH' as const,
        isOn: mapBooleanState(switchCapability.getIsOnEvent(), device)
      });
    }

    case 'BATTERY_LEVEL_INDICATOR': {
      const battery = device.getBatteryLevelIndicatorCapability();
      return awaitPromises({
        type: 'BATTERY_LEVEL_INDICATOR' as const,
        batteryPercentage: mapNumericState(battery.getBatteryPercentageEvent(), device)
      });
    }

    case 'BATTERY_LOW_INDICATOR': {
      const battery = device.getBatteryLowIndicatorCapability();
      return awaitPromises({
        type: 'BATTERY_LOW_INDICATOR' as const,
        isLow: mapBooleanState(battery.getIsBatteryLowEvent(), device)
      });
    }

    case 'CONTACT_SENSOR': {
      const sensor = device.getContactSensorCapability();
      const event = await sensor.getIsClosedEvent();

      return {
        type: 'CONTACT_SENSOR' as const,
        isClosed: await mapBooleanState(Promise.resolve(event), device),
        lastTriggered: event ? {
          start: event.start.toISOString(),
          end: event.end?.toISOString() ?? null,
          durationSeconds: event.end
            ? Math.round((event.end.getTime() - event.start.getTime()) / 1000)
            : null
        } : null
      };
    }

    case 'BIN_COLLECTION': {
      const cap = device.getBinCollectionCapability();
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
      const ev = device.getElectricVehicleCapability();

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
      const conn = device.getConnectivityCapability();
      return awaitPromises({
        type: 'CONNECTIVITY' as const,
        isConnected: mapBooleanState(conn.getIsConnectedEvent(), device)
      });
    }

    case 'ENERGY_MONITOR': {
      const energyMonitor = device.getEnergyMonitorCapability();
      return awaitPromises({
        type: 'ENERGY_MONITOR' as const,
        currentPower: mapNumericState(energyMonitor.getCurrentPowerEvent(), device),
        dayEnergy: mapNumericState(energyMonitor.getDayEnergyEvent(), device),
        dayCost: mapNumericState(energyMonitor.getDayCostEvent(), device)
      });
    }

    case 'ENERGY_COST': {
      const energyCost = device.getEnergyCostCapability();
      return awaitPromises({
        type: 'ENERGY_COST' as const,
        unitRate: mapNumericState(energyCost.getUnitRateEvent(), device),
        standingCharge: mapNumericState(energyCost.getStandingChargeEvent(), device)
      });
    }

    case 'OVEN': {
      const oven = device.getOvenCapability();

      return awaitPromises({
        type: 'OVEN' as const,
        runningProgram: mapStringState(oven.getProgramNameEvent(), device),
        setpointTemperature: mapNumericState(oven.getSetpointTemperatureEvent(), device),
        currentTemperature: mapNumericState(oven.getCurrentTemperatureEvent(), device),
      });
    }

    case 'MICROWAVE': {
      const mw = device.getMicrowaveCapability();

      return awaitPromises({
        type: 'MICROWAVE' as const,
        runningProgram: mapStringState(mw.getProgramNameEvent(), device),
        estimatedCompletionTime: mapNumericState(mw.getEstimatedCompletionTimeEvent(), device),
      });
    }

    case 'DISHWASHER': {
      const dw = device.getDishwasherCapability();
      const now = new Date();
      const machineCareRuns = await dw.getProgramNameHistory({
        since: device.createdAt,
        until: now,
        value: { eq: 'Machine Care' },
        limit: 1,
      });
      const lastSelfCareRun = machineCareRuns[0] ?? null;

      return awaitPromises({
        type: 'DISHWASHER' as const,
        runningProgram: mapStringState(dw.getProgramNameEvent(), device),
        estimatedCompletionTime: mapNumericState(dw.getEstimatedCompletionTimeEvent(), device),
        lastSelfCareRun: lastSelfCareRun ? mapStringState(Promise.resolve(lastSelfCareRun), device) : Promise.resolve(null),
        isSaltLow: mapBooleanState(dw.getIsSaltLowEvent(), device),
        isRinseAidLow: mapBooleanState(dw.getIsRinseAidLowEvent(), device),
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
    lastSeen,
    capabilities: capabilityData
  };
}
