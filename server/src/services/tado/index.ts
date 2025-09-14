import { Device, Event, Stay } from '../../models';
import TadoClient, { getAccessToken } from './client';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import moment, { Moment } from 'moment';
import getTimetabledTemperature from './helpers/get-timetabled-temperature';
import getWarmupRatePerHour from './helpers/get-warmup-rate-per-hour';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';
import logger from '../../logger';

const CENTRAL_HEATING_MODES = {
  ON: 1,
  OFF: 2,
  SETBACK: 3
};

type NextTarget = {
  nextTargetTime: Moment,
  nextTargetTemperature: number
};

type DeviceState = {
  device: Device,
  linkedZoneDevices: DeviceState[],
  hasManualOverride: boolean,
} & ({
  shouldScheduleForEarlyStart: true,
  nextTarget: NextTarget,
  warmupRatePerHour: number
} | {
  shouldScheduleForEarlyStart: false,
  nextTarget: NextTarget | null
  warmupRatePerHour: number | null
});

Device.registerProvider('tado', {
  getCapabilities(device) {
    if (device.type === 'thermostat') {
      return [
        'HUMIDITY_SENSOR',
        'TEMPERATURE_SENSOR',
        'THERMOSTAT'
      ];
    }

    return [];
  },

  provideThermostatCapability() {
    return {
      async setTargetTemperature(device: Device, value: number | null) {
        const client = new TadoClient(await getAccessToken(), config.tado.home_id);

        await client.setHeatingPowerForZone(device.providerId, value === null ? false : value, false);
      },

      async setIsOn(device: Device, isOn: boolean) {
        const client = new TadoClient(await getAccessToken(), config.tado.home_id);

        if (isOn === true) {
          const data = await client.getZoneState(device.providerId);

          if (data.overlayType === 'MANUAL' && data.overlay.setting.power === 'OFF') {
            await client.endManualHeatingForZone(device.providerId);
          }
        } else /* value === false */ {
          await client.setHeatingPowerForZone(device.providerId, false, false);
        }
      }
    }
  },

  async synchronize() {
    const client = new TadoClient(await getAccessToken(), config.tado.home_id);
    const zones = await client.getZones();

    for (const zone of zones) {
      if (zone.type === 'HEATING') {
        let knownDevice = await Device.findByProviderId('tado', zone.id);

        if (!knownDevice) {
          knownDevice = Device.build({
            type: 'thermostat',
            provider: 'tado',
            providerId: zone.id
          });
        }

        knownDevice.name = `${zone.name} Thermostat`;
        await knownDevice.save();
      }
    }

    {
      let controller = await Device.findByProviderId('tado', 'controller');

      if (!controller) {
        await Device.create({
          provider: 'tado',
          type: 'controller',
          providerId: 'controller',
          name: 'Controller'
        });
      }
    }
  }
});

export async function setCentralHeatingMode(mode: keyof typeof CENTRAL_HEATING_MODES) {
  // There are two ways of doing this; first, we could just set the whole House in Tado to 
  // "away" using the /presenceLock endpoint. On the face of it this seems the easiest. 
  // However you then have to worry about all the thermostats that are in manual mode (either
  // because we ourselves have set them for scheduled warm ups, or because a user has manually).
  //
  // So you'd have to iterate over all the thermostats anyway, and remove any manual overlays.
  // You could also argue we should display the "Tado House Away" mode somewhere in the UI.
  //
  // Second option is to just manually set each thermostat to it's away temperature, which is what
  // we've ended up doing.
  const client = new TadoClient(await getAccessToken(), config.tado.home_id);
  const devices = await Device.findByProvider('tado');
  const controller = devices.find(x => x.providerId === 'controller')!;

  for (const device of devices) {
    if (device.type === 'thermostat') {
      const zoneId = device.providerId;
      
      if (mode === 'ON') {
        await client.endManualHeatingForZone(zoneId);
      } else if (mode === 'OFF') {
        await device.getThermostatCapability().setIsOn(false);
      } else if (mode === 'SETBACK') {
        const awayTemperature = await client.getMinimumAwayTemperatureForZone(zoneId);

        await device.getThermostatCapability().setTargetTemperature(awayTemperature);
      }
    }
  }

  const lastEvent = await controller.getLatestEvent('central_heating_mode');

  if (lastEvent === null || lastEvent.value !== CENTRAL_HEATING_MODES[mode]) {
    const now = new Date();

    if (lastEvent) {
      lastEvent.end = now;
      await lastEvent.save();
    }

    // TODO: This shouldn't sit here; whole point of this is stop services controlling Events
    await Event.create({
      deviceId: controller.id,
      start: now,
      type: 'central_heating_mode',
      value: CENTRAL_HEATING_MODES[mode]
    })
  }
}

export async function getCentralHeatingMode(): Promise<keyof typeof CENTRAL_HEATING_MODES> {
  const controller = await Device.findByProviderIdOrError('tado', 'controller');
  const lastEvent = await controller.getLatestEvent('central_heating_mode');

  if (lastEvent === null) {
    return 'ON';
  }

  switch (lastEvent.value) {
    case CENTRAL_HEATING_MODES.OFF:
      return 'OFF';
    case CENTRAL_HEATING_MODES.ON:
      return 'ON';
    case CENTRAL_HEATING_MODES.SETBACK:
      return 'SETBACK';
  }
  
  throw new Error();
}

nowAndSetInterval(createBackgroundTransaction('tado:sync', async () => {
  const client = new TadoClient(await getAccessToken(), config.tado.home_id);
  const devices = await Device.findByProvider('tado');

  for (const device of devices) {
    if (device.type === 'thermostat') {
      const data = await client.getZoneState(device.providerId);
      const deviceCapability = device.getThermostatCapability();

      await Promise.all([
        deviceCapability.setPowerState(data.activityDataPoints.heatingPower.percentage, new Date(data.activityDataPoints.heatingPower.timestamp)),
        deviceCapability.setIsOnState(data.activityDataPoints.heatingPower.percentage > 0, new Date(data.activityDataPoints.heatingPower.timestamp)),
        deviceCapability.setHumidityState(data.sensorDataPoints.humidity.percentage, new Date(data.sensorDataPoints.humidity.timestamp)),
        deviceCapability.setCurrentTemperatureState(data.sensorDataPoints.insideTemperature.celsius, new Date(data.sensorDataPoints.insideTemperature.timestamp)),
        deviceCapability.setTargetTemperatureState(data.setting.power === 'ON' ? data.setting.temperature.celsius : 0, new Date())
      ]);
    }
  }
}), Math.max(config.tado.sync_interval_seconds, 10) * 1000);


const getNextTargetForThermostatGenerator = (isSomeoneAtHome: boolean, client: TadoClient, nextEta: Stay | null) => async (device: Device, zoneState: any, activeTimetable: any): Promise<NextTarget | null> => {
  if (isSomeoneAtHome) {
    const { nextScheduleChange } = zoneState;

    if (nextScheduleChange.setting.power === 'ON') {
      return {
        nextTargetTime: moment(nextScheduleChange.start),
        nextTargetTemperature: nextScheduleChange.setting.temperature.celsius
      };
    }
  } else if (nextEta) {
    const temperature = getTimetabledTemperature(await client.getTimetableBlocks(device.providerId, activeTimetable), moment(nextEta.eta));

    if (temperature !== null) {
      return {
        nextTargetTime: moment(nextEta.eta),
        nextTargetTemperature: temperature
      };
    }
  }

  return null;
};

if (config.tado.enable_warm_up) {
  nowAndSetInterval(createBackgroundTransaction('tado:warm-up', async () => {
    const client = new TadoClient(await getAccessToken(), config.tado.home_id);
    const [
      isSomeoneAtHome, 
      nextEta
    ] = await Promise.all([
      Stay.checkIfSomeoneHomeAt(new Date()),
      Stay.findNextUpcomingEta()
    ]);

    const getNextTargetForThermostat = getNextTargetForThermostatGenerator(isSomeoneAtHome, client, nextEta);
    const deviceStates: DeviceState[] = [];

    for (const device of await Device.findByProvider('tado')) {
      if (device.type === 'thermostat') {
        const [
          currentTemperature,
          targetTemperature,
          zoneState,
          activeTimetable
        ] = await Promise.all([
          device.getThermostatCapability().getCurrentTemperature(),
          device.getThermostatCapability().getTargetTemperature(),
          client.getZoneState(device.providerId),
          client.getActiveTimetable(device.providerId)
        ]);

        let warmupRatePerHour = null;
    
        const nextTarget = await getNextTargetForThermostat(device, zoneState, activeTimetable);
        const hasManualOverride = zoneState.overlayType === 'MANUAL';
    
        if (nextTarget !== null) {
          const { nextTargetTemperature, nextTargetTime }  = nextTarget;
    
          // Don't make any changes if we have a manual override, or if the current target is more than the 
          // next target.
          if (nextTargetTemperature > targetTemperature && !hasManualOverride) {
            warmupRatePerHour = await getWarmupRatePerHour(device);

            const difference = nextTargetTemperature - currentTemperature;
            const hoursNeededToWarmUp = difference / warmupRatePerHour;

            if (moment().add(hoursNeededToWarmUp, 'h').isAfter(nextTargetTime)) {
              deviceStates.push({
                device,
                linkedZoneDevices: [],
                shouldScheduleForEarlyStart: true,
                hasManualOverride,
                nextTarget,
                warmupRatePerHour
              });
              
              continue;
            }
          }
        }

        deviceStates.push({
          device,
          linkedZoneDevices: [],
          shouldScheduleForEarlyStart: false,
          hasManualOverride,
          nextTarget,
          warmupRatePerHour
        });
      }
    }

    // Figure out linked zones, so that if a certain thermostat should be turned "on", we can also
    // turn on linked zones as well.
    for (const linkedZones of config.tado.linked_zones) {
      const matchingDeviceStates = deviceStates.filter(x => linkedZones.includes(x.device.name));

      if (linkedZones.length !== matchingDeviceStates.length) {
        throw new Error(`One of ${linkedZones} does not map to a known thermostat`);
      }

      for (const matchingDeviceState of matchingDeviceStates) {
        matchingDeviceState.linkedZoneDevices.push(...matchingDeviceStates.filter(x => x !== matchingDeviceState));
      }
    }

    for (const deviceState of deviceStates) {
      if (deviceState.shouldScheduleForEarlyStart) {
        // We don't change a linked zone if it itself is scheduled for switch on, or if it's already got a 
        // manual configuration (either on from a previous job run, or human override, or if doesn't have a next target)
        const devicesToEnable = [deviceState, ...deviceState.linkedZoneDevices.filter(x => {
          return !x.shouldScheduleForEarlyStart && !x.hasManualOverride && x.nextTarget !== null
        })];

        for (const deviceToEnable of devicesToEnable) {
          await client.setHeatingPowerForZone(deviceToEnable.device.providerId, deviceToEnable.nextTarget!.nextTargetTemperature, true);
        }

        const zoneMessage = deviceState.linkedZoneDevices.length > 0 
          ? ` (+${devicesToEnable.length - 1} of ${deviceState.linkedZoneDevices.length} linked zones)`
          : ``;

        bus.emit(NOTIFICATION_TO_ADMINS, {
          message: `Setting "${deviceState.device.name}" to ${deviceState.nextTarget.nextTargetTemperature.toFixed(1)}°${zoneMessage}, so hopefully we'll heat up by ${deviceState.warmupRatePerHour.toFixed(1)}°/hr to reach the target temperature by ${deviceState.nextTarget.nextTargetTime.format('HH:mm')}!`
        });
      }
    }
  }), Math.max(config.tado.eta_check_interval_minutes, 1) * 60 * 1000);
} else {
  logger.info(`Tado: config.enable_warm_up is not set to true. Early start/ preheating is disabled.`);
}