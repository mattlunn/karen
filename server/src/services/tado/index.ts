import { Device, Stay } from '../../models';
import TadoClient, { TadoClientError, Zone, ZoneState, exchangeRefreshTokenForAccessToken } from './client';
import config from '../../config';
import { saveConfig } from '../../helpers/config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import dayjs, { Dayjs } from '../../dayjs';
import getTimetabledTemperature from './helpers/get-timetabled-temperature';
import getWarmupRatePerHour from './helpers/get-warmup-rate-per-hour';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';
import logger from '../../logger';

type NextTarget = {
  nextTargetTime: Dayjs,
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

const getAccessToken = (() => {
  let token: { accessToken: string, expiresAt: number } | null = null;

  async function getNewAccessToken(): Promise<string> {
    if (!token || token.expiresAt < Date.now() + 1000 * 60) {
      const newToken = await exchangeRefreshTokenForAccessToken(config.tado.refresh_token);

      token = {
        accessToken: newToken.accessToken,
        expiresAt: newToken.expiresAt
      };

      config.tado.refresh_token = newToken.refreshToken;
      saveConfig();
    }

    return token.accessToken;
  }

  let pendingRequestForAccessToken: Promise<string> | null = null;

  return (): Promise<string> => {
    if (pendingRequestForAccessToken) {
      return pendingRequestForAccessToken;
    } else {
      return pendingRequestForAccessToken = getNewAccessToken().finally(() => {
        pendingRequestForAccessToken = null;
      });
    }
  };
})();

Device.registerProvider('tado', {
  getCapabilities() {
    return [
      'HUMIDITY_SENSOR',
      'TEMPERATURE_SENSOR',
      'THERMOSTAT',
      'BATTERY_LOW_INDICATOR'
    ];
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
          // Expected end state is for heating to be on; so we just end any manual overlays.
          // Tado API throws a 404 if there is no manual overlay to end, so ignore those errors.
          try {
            await client.endManualHeatingForZone(device.providerId);
          } catch (e) {
            if (!(e instanceof TadoClientError) || e.code !== 'notFound') {
              throw e;
            }
          }
        } else /* value === false */ {
          await client.setHeatingPowerForZone(device.providerId, false, false);
        }
      }
    };
  },

  async synchronize() {
    const client = new TadoClient(await getAccessToken(), config.tado.home_id);
    const zones = await client.getZones();

    for (const zone of zones) {
      if (zone.type === 'HEATING') {
        const zoneIdStr = String(zone.id);
        const hasLowBattery = zone.devices.some(d => d.batteryState === 'LOW');
        let knownDevice = await Device.findByProviderId('tado', zoneIdStr);

        if (!knownDevice) {
          knownDevice = Device.build({
            provider: 'tado',
            providerId: zoneIdStr
          });
        }

        knownDevice.manufacturer = 'tado';
        knownDevice.model = zone.devices[0]?.deviceType ?? 'Unknown';
        knownDevice.name = `${zone.name} Thermostat`;

        await knownDevice.save();
        await knownDevice.getThermostatCapability().setSetbackTemperatureState(await client.getMinimumAwayTemperatureForZone(zoneIdStr));
        await knownDevice.getBatteryLowIndicatorCapability().setIsBatteryLowState(hasLowBattery);
      }
    }
  }
});

nowAndSetInterval(createBackgroundTransaction('tado:sync', async () => {
  const client = new TadoClient(await getAccessToken(), config.tado.home_id);
  const devices = await Device.findByProvider('tado');
  const zonesState = await client.getZonesState();

  for (const device of devices) {
    const deviceCapability = device.getThermostatCapability();
    const zoneState = zonesState[Number(device.providerId)];

    if (zoneState === undefined) {
      logger.warn(`Tado: No zone state found for device ${device.name} (provider id ${device.providerId})`);
      continue;
    }

    await Promise.all([
      deviceCapability.setPowerState(zoneState.activityDataPoints.heatingPower.percentage, new Date(zoneState.activityDataPoints.heatingPower.timestamp)),
      deviceCapability.setIsOnState(zoneState.activityDataPoints.heatingPower.percentage > 0, new Date(zoneState.activityDataPoints.heatingPower.timestamp)),
      deviceCapability.setHumidityState(zoneState.sensorDataPoints.humidity.percentage, new Date(zoneState.sensorDataPoints.humidity.timestamp)),
      deviceCapability.setCurrentTemperatureState(zoneState.sensorDataPoints.insideTemperature.celsius, new Date(zoneState.sensorDataPoints.insideTemperature.timestamp)),
      deviceCapability.setTargetTemperatureState(zoneState.setting.power === 'ON' ? zoneState.setting.temperature.celsius : 0, new Date())
    ]);
  }
}), Math.max(config.tado.sync_interval_seconds, 10) * 1000);


const getNextTargetForThermostatGenerator = (isSomeoneAtHome: boolean, client: TadoClient, nextEta: Stay | null) => async (device: Device, zoneState: ZoneState): Promise<NextTarget | null> => {
  if (isSomeoneAtHome) {
    const { nextScheduleChange } = zoneState;

    if (nextScheduleChange && nextScheduleChange.setting.power === 'ON') {
      return {
        nextTargetTime: dayjs(nextScheduleChange.start),
        nextTargetTemperature: nextScheduleChange.setting.temperature.celsius
      };
    }
  } else if (nextEta) {
    const activeTimetableId = await client.getActiveTimetableId(device.providerId);
    const timetabledBlocks = await client.getTimetableBlocks(device.providerId, activeTimetableId);
    const temperature = getTimetabledTemperature(timetabledBlocks, dayjs(nextEta.eta));

    if (temperature !== null) {
      return {
        nextTargetTime: dayjs(nextEta.eta),
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
      nextEta,
      zoneStates
    ] = await Promise.all([
      Stay.checkIfSomeoneHomeAt(new Date()),
      Stay.findNextUpcomingEta(),
      client.getZonesState()
    ]);

    const getNextTargetForThermostat = getNextTargetForThermostatGenerator(isSomeoneAtHome, client, nextEta);
    const deviceStates: DeviceState[] = [];

    for (const device of await Device.findByProvider('tado')) {
      const zoneState = zoneStates[Number(device.providerId)];
      const [
        currentTemperature,
        targetTemperature,
      ] = await Promise.all([
        device.getThermostatCapability().getCurrentTemperature(),
        device.getThermostatCapability().getTargetTemperature(),
      ]);

      let warmupRatePerHour = null;

      const nextTarget = await getNextTargetForThermostat(device, zoneState);
      const hasManualOverride = zoneState.overlayType === 'MANUAL';

      if (nextTarget !== null) {
        const { nextTargetTemperature, nextTargetTime }  = nextTarget;

        // Don't make any changes if we have a manual override, or if the current target is more than the
        // next target.
        if (nextTargetTemperature > targetTemperature && !hasManualOverride) {
          warmupRatePerHour = Math.max(await getWarmupRatePerHour(device), config.tado.min_warm_up_per_hour_degrees);

          const difference = nextTargetTemperature - currentTemperature;
          const hoursNeededToWarmUp = difference / warmupRatePerHour;

          if (dayjs().add(hoursNeededToWarmUp, 'h').isAfter(nextTargetTime)) {
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
          return !x.shouldScheduleForEarlyStart && !x.hasManualOverride && x.nextTarget !== null;
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
