import { Device, Event, Stay } from '../../models';
import TadoClient, { getAccessToken } from './client';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { sendNotification } from '../../helpers/notification';
import bus, { FIRST_USER_HOME, LAST_USER_LEAVES } from '../../bus';
import moment from 'moment';

Device.registerProvider('tado', {
  async setProperty(device, key, value) {
    switch (key) {
      case 'target': {
        const client = new TadoClient(await getAccessToken(), config.tado.home_id);
        await client.setHeatingPowerForZone(device.providerId, value === null ? false : value);

        break;
      }
      default:
        throw new Error(`Unable to handle setting '${key}' for ${device.type}`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
      case 'target':
      case 'temperature':
      case 'humidity':
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

nowAndSetInterval(async () => {
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
        updateState(device, 'target', data.setting.power === 'ON' ? data.setting.temperature.celsius : 0)
      ]);
    }
  }
}, Math.max(config.tado.sync_interval_seconds, 10) * 1000);

bus.on(LAST_USER_LEAVES, async () => {
  const client = new TadoClient(await getAccessToken(), config.tado.home_id);
  const devices = await Device.findByProvider('tado');

  for (const device of devices) {
    if (device.type === 'thermostat') {
      await client.setHeatingPowerForZone(device.providerId, false);
    }
  }
});

bus.on(FIRST_USER_HOME, async () => {
  const client = new TadoClient(await getAccessToken(), config.tado.home_id);
  const devices = await Device.findByProvider('tado');

  for (const device of devices) {
    if (device.type === 'thermostat') {
      const data = await client.getZoneState(device.providerId);

      if (data.overlayType === 'MANUAL' && data.overlay.setting.power === 'OFF') {
        await client.endManualHeatingForZone(device.providerId);
      }
    }
  }
});

nowAndSetInterval(async () => {
  const client = new TadoClient(await getAccessToken(), config.tado.home_id);
  const now = moment();
  const isSomeoneAtHome = await Stay.checkIfSomeoneHomeAt(now.valueOf());

  function getTimetabledTemperature(timetable, time) {
    function getDayTypes() {
      switch (time.day()) {
        case 0:
          return ['SUNDAY', 'MONDAY_TO_SUNDAY'];
        case 1:
          return ['MONDAY', 'MONDAY_TO_SUNDAY', 'MONDAY_TO_FRIDAY'];
        case 2:
          return ['TUESDAY', 'MONDAY_TO_SUNDAY', 'MONDAY_TO_FRIDAY'];
        case 3:
          return ['WEDNESDAY', 'MONDAY_TO_SUNDAY', 'MONDAY_TO_FRIDAY'];
        case 4:
          return ['THURSDAY', 'MONDAY_TO_SUNDAY', 'MONDAY_TO_FRIDAY'];
        case 5:
          return ['FRIDAY', 'MONDAY_TO_SUNDAY', 'MONDAY_TO_FRIDAY'];
        case 6:
          return ['SATURDAY', 'MONDAY_TO_SUNDAY'];
      }
    }

    const dayTypes = getDayTypes();

    return timetable.find(block => {
      if (!dayTypes.includes(block.dayType)) {
        return false;
      }

      return moment(block.start, 'HH:mm').isBefore(time) && moment(block.end, 'HH:mm').isAfter(time);
    });
  }

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

            console.log(`"${device.name}" is currently at ${currentTemperature}. ETA is for ${nextEta.eta}, where the temperature is expected to be ${desiredTemperature}`);

            if (difference > Math.round(moment(nextEta.eta).diff(now, 'm') / 60)) {
              console.log(`Ending Manual heating for ${device.name}. Hope it's warm when you get home!`);
              sendNotification(`Turning "${device.name}" on, so hopefully it'll get from ${currentTemperature.toFixed(1)} to ${desiredTemperature.toFixed(1)} by the time you get home!`);

              await client.endManualHeatingForZone(device.providerId);
            }
          }
        }
      }
    }
  }
}, Math.max(config.tado.eta_check_interval_minutes, 15) * 60 * 1000);