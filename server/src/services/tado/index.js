import { Device, Event, Stay } from '../../models';
import TadoClient, { getAccessToken } from './client';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { sendNotification } from '../../helpers/notification';
import moment from 'moment';
import getTimetabledTemperature from './helpers/get-timetabled-temperature';
import getWarmupRatePerHour from './helpers/get-warmup-rate-per-hour';
import { createBackgroundTransaction } from '../../helpers/newrelic';

Device.registerProvider('tado', {
  async setProperty(device, key, value) {
    switch (key) {
      case 'target': {
        const client = new TadoClient(await getAccessToken(), config.tado.home_id);
        await client.setHeatingPowerForZone(device.providerId, value === null ? false : value);

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
  }
});

nowAndSetInterval(createBackgroundTransaction('tado:sync', async () => {
  const client = new TadoClient(await getAccessToken(), config.tado.home_id);
  const devices = await Device.findByProvider('tado');

  async function updateState(device, type, currentValue, timestamp) {
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
    Stay.checkIfSomeoneHomeAt(Date.now()),
    Stay.findNextUpcomingEta()
  ]);

  const devices = await Device.findByProvider('tado');
  const getNextTargetForThermostat = async (device, zoneState, activeTimetable) => {
    if (isSomeoneAtHome) {
      const { nextScheduleChange } = zoneState;

      return {
        nextTargetTime: moment(nextScheduleChange.start),
        nextTargetTemperature: nextScheduleChange.setting.power === 'ON' ? nextScheduleChange.setting.temperature.celsius : null
      };
    } else if (nextEta) {
      const { setting: timetabledTemperature } = getTimetabledTemperature(await client.getTimetableBlocks(device.providerId, activeTimetable), moment(nextEta.eta));

      return {
        nextTargetTime: moment(nextEta.eta),
        nextTargetTemperature: timetabledTemperature.temperature.celsius
      };
    }

    return {};
  };

  for (const device of devices) {
    if (device.type === 'thermostat') {
      const [
        currentTemperature,
        zoneState,
        activeTimetable
      ] = await Promise.all([
        device.getProperty('temperature'),
        client.getZoneState(device.providerId),
        client.getActiveTimetable(device.providerId)
      ]);

      const { nextTargetTime, nextTargetTemperature } = await getNextTargetForThermostat(device, zoneState, activeTimetable);

      console.log(`For ${device.name}, nextTargetTime: ${nextTargetTime}, nextTargetTemperature: ${nextTargetTemperature}`);

      // Unless manual override with a end time
      if (nextTargetTemperature > currentTemperature && (zoneState.overlayType !== 'MANUAL' || zoneState.overlay.termination.type === 'MANUAL')) {
        const difference = nextTargetTemperature - currentTemperature;
        const warmupRatePerHour = await getWarmupRatePerHour(device);
        const hoursNeededToWarmUp = difference / warmupRatePerHour;

        if (moment().add(hoursNeededToWarmUp, 'h').isAfter(nextTargetTime)) {
          sendNotification(`Setting "${device.name}" to ${nextTargetTemperature.toFixed(1)}, so hopefully we'll heat up by ${warmupRatePerHour.toFixed(1)}°/hr to reach the target temperature by ${nextTargetTime.format('HH:mm')}!`);

          await client.setHeatingPowerForZone(device.providerId, nextTargetTemperature, true);
        }
      }
    }
  }
}), Math.max(config.tado.eta_check_interval_minutes, 10) * 60 * 1000);