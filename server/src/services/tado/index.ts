import { Device, Event, Stay } from '../../models';
import TadoClient, { getAccessToken } from './client';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import moment, { Moment } from 'moment';
import getTimetabledTemperature from './helpers/get-timetabled-temperature';
import getWarmupRatePerHour from './helpers/get-warmup-rate-per-hour';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';

const CENTRAL_HEATING_MODES = {
  ON: 1,
  OFF: 2,
  SETBACK: 3
};

Device.registerProvider('tado', {
  async setProperty(device, key, value) {
    switch (key) {
      case 'target': {
        const client = new TadoClient(await getAccessToken(), config.tado.home_id);
        await client.setHeatingPowerForZone(device.providerId, value === null ? false : value, false);

        break;
      }
      case 'on': {
        const client = new TadoClient(await getAccessToken(), config.tado.home_id);

        if (value === true) {
          const data = await client.getZoneState(device.providerId);

          if (data.overlayType === 'MANUAL' && data.overlay.setting.power === 'OFF') {
            await client.endManualHeatingForZone(device.providerId);
          }
        } else /* value === false */ {
          await client.setHeatingPowerForZone(device.providerId, false);
        }

        break;
      }
      default:
        throw new Error(`Unable to handle setting '${key}' for ${device.type}`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
      case 'connected':
        return true;
      case 'target':
      case 'temperature':
      case 'humidity':
      case 'power':
        return (await device.getLatestEvent(key)).value;
      case 'heating': {
        const latestEvent = await device.getLatestEvent(key);
        return !!latestEvent && !latestEvent.end;
      }
      default:
        throw new Error(`Unable to handle retrieving '${key}' for ${device.type}`);
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
        await device.setProperty('target', false);
      } else if (mode === 'SETBACK') {
        const awayTemperature = await client.getMinimumAwayTemperatureForZone(zoneId);

        await device.setProperty('target', awayTemperature);
      }
    }
  }

  const lastEvent = await controller.getLatestEvent('central_heating_mode');

  if (lastEvent === null || lastEvent.value !== mode) {
    const now = new Date();

    if (lastEvent) {
      lastEvent.end = now;
      await lastEvent.save();
    }

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

  async function updateState(device: Device, type: string, currentValue: number | boolean, timestamp: Date) {
    const lastEvent = await device.getLatestEvent(type);
    const valueHasChanged = !lastEvent
      || typeof currentValue === 'number' && currentValue !== lastEvent.value
      || typeof currentValue === 'boolean' && !lastEvent.end !== currentValue;

    if (valueHasChanged) {
      // on -> off (update old, don't create new)
      // off -> on (don't touch old, create new)
      // value -> value (update old, create new)

      if (lastEvent && currentValue !== true) {
        lastEvent.end = timestamp;
        await lastEvent.save();
      }

      if (currentValue !== false) {
        await Event.create({
          deviceId: device.id,
          start: timestamp,
          value: Number(currentValue),
          type
        });
      }

      device.onPropertyChanged(type);
    }
  }

  for (const device of devices) {
    if (device.type === 'thermostat') {
      const data = await client.getZoneState(device.providerId);

      await Promise.all([
        updateState(device, 'power', data.activityDataPoints.heatingPower.percentage, new Date(data.activityDataPoints.heatingPower.timestamp)),
        updateState(device, 'heating', data.activityDataPoints.heatingPower.percentage > 0, new Date(data.activityDataPoints.heatingPower.timestamp)),
        updateState(device, 'humidity', data.sensorDataPoints.humidity.percentage, new Date(data.sensorDataPoints.humidity.timestamp)),
        updateState(device, 'temperature', data.sensorDataPoints.insideTemperature.celsius, new Date(data.sensorDataPoints.insideTemperature.timestamp)),
        updateState(device, 'target', data.setting.power === 'ON' ? data.setting.temperature.celsius : 0, new Date())
      ]);
    }
  }
}), Math.max(config.tado.sync_interval_seconds, 10) * 1000);

nowAndSetInterval(createBackgroundTransaction('tado:warm-up', async () => {
  const client = new TadoClient(await getAccessToken(), config.tado.home_id);
  const [
    isSomeoneAtHome, 
    nextEta
  ] = await Promise.all([
    Stay.checkIfSomeoneHomeAt(new Date()),
    Stay.findNextUpcomingEta()
  ]);

  const devices = await Device.findByProvider('tado');
  const getNextTargetForThermostat = async (device: Device, zoneState: any, activeTimetable: any): Promise<{
    nextTargetTime: Moment,
    nextTargetTemperature: number
  } | null> => {
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

  for (const device of devices) {
    if (device.type === 'thermostat') {
      const [
        currentTemperature,
        zoneState,
        activeTimetable
      ] = await Promise.all([
        device.getProperty<number>('temperature'),
        client.getZoneState(device.providerId),
        client.getActiveTimetable(device.providerId)
      ]);

      const nextTarget = await getNextTargetForThermostat(device, zoneState, activeTimetable);

      if (nextTarget !== null) {
        const { nextTargetTemperature, nextTargetTime }  = nextTarget;

        // Unless manual override with a end time
        if (nextTargetTemperature > currentTemperature && (zoneState.overlayType !== 'MANUAL' || zoneState.overlay.termination.type === 'MANUAL')) {
          const difference = nextTargetTemperature - currentTemperature;
          const warmupRatePerHour = await getWarmupRatePerHour(device);
          const hoursNeededToWarmUp = difference / warmupRatePerHour;

          if (moment().add(hoursNeededToWarmUp, 'h').isAfter(nextTargetTime)) {
            bus.emit(NOTIFICATION_TO_ADMINS, {
              message: `Setting "${device.name}" to ${nextTargetTemperature.toFixed(1)}, so hopefully we'll heat up by ${warmupRatePerHour.toFixed(1)}°/hr to reach the target temperature by ${nextTargetTime.format('HH:mm')}!`
            });

            await client.setHeatingPowerForZone(device.providerId, nextTargetTemperature, true);
          }
        }
      }
    }
  }
}), Math.max(config.tado.eta_check_interval_minutes, 10) * 60 * 1000);