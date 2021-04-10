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

  async function updateState(device, type, currentValue) {
    const lastEvent = await device.getLatestEvent(type);
    const valueHasChanged = !lastEvent
      || typeof currentValue === 'number' && currentValue !== lastEvent.value
      || typeof currentValue === 'boolean' && !lastEvent.end !== currentValue;

    if (valueHasChanged) {
      // on -> off (update old, don't create new)
      // off -> on (don't touch old, create new)
      // value -> value (update old, create new)

      if (lastEvent && currentValue !== true) {
        lastEvent.end = Date.now();
        await lastEvent.save();
      }

      if (currentValue !== false) {
        await Event.create({
          deviceId: device.id,
          start: Date.now(),
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
        updateState(device, 'heating', data.activityDataPoints.heatingPower.percentage > 0),
        updateState(device, 'humidity', data.sensorDataPoints.humidity.percentage),
        updateState(device, 'temperature', data.sensorDataPoints.insideTemperature.celsius),
        updateState(device, 'target', data.setting.power === 'ON' ? data.setting.temperature.celsius : 0),
        updateState(device, 'power', data.activityDataPoints.heatingPower.percentage)
      ]);
    }
  }
}), Math.max(config.tado.sync_interval_seconds, 10) * 1000);

nowAndSetInterval(createBackgroundTransaction('tado:eta', async () => {
  const client = new TadoClient(await getAccessToken(), config.tado.home_id);
  const now = moment();
  const isSomeoneAtHome = await Stay.checkIfSomeoneHomeAt(now.valueOf());

  if (!isSomeoneAtHome) {
    const nextEta = await Stay.findNextUpcomingEta();

    if (nextEta) {
      const devices = await Device.findByProvider('tado');

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

          const { setting: timetabledTemperature } = getTimetabledTemperature(await client.getTimetableBlocks(device.providerId, activeTimetable), moment(nextEta.eta));

          if (zoneState.overlayType === 'MANUAL' && zoneState.overlay.setting.power === 'OFF' && timetabledTemperature.power !== 'OFF') {
            const desiredTemperature = timetabledTemperature.temperature.celsius;
            const difference = desiredTemperature - currentTemperature;
            const warmupRatePerHour = await getWarmupRatePerHour(device);
            const hoursNeededToWarmUp = difference / warmupRatePerHour;

            if (moment().add(hoursNeededToWarmUp, 'h').isAfter(nextEta.eta)) {
              sendNotification(`Turning "${device.name}" on, so hopefully we'll heat up by ${warmupRatePerHour.toFixed(1)}°/hr to get from ${currentTemperature.toFixed(1)} to ${desiredTemperature.toFixed(1)} by the time you get home!`);

              await client.endManualHeatingForZone(device.providerId);
            }
          }
        }
      }
    }
  }
}), Math.max(config.tado.eta_check_interval_minutes, 10) * 60 * 1000);