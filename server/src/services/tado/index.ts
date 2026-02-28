import { Device } from '../../models';
import { ScheduledChange } from '../../models/capabilities';
import TadoClient, { TadoClientError, ZoneOverlayResponse, ZoneState, ZoneTimetableBlock, ZonesState, exchangeRefreshTokenForAccessToken } from './client';
import config from '../../config';
import { saveConfig } from '../../helpers/config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import dayjs from '../../dayjs';
import getTimetabledTemperature from './helpers/get-timetabled-temperature';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import logger from '../../logger';
import setIntervalForTime from '../../helpers/set-interval-for-time';

const nextScheduledChangeCache = new Map<string, ZoneState['nextScheduleChange']>();
const deviceTimetableCache = new Map<string, ZoneTimetableBlock[]>();

setIntervalForTime(() => {
  deviceTimetableCache.clear();

  for (const [key, value] of nextScheduledChangeCache) {
    if (value === null) {
      nextScheduledChangeCache.delete(key);
    }
  }
}, '00:00');

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

async function updateTargetTemperatureFromOverlay(device: Device, overlay: ZoneOverlayResponse): Promise<void> {
  const thermostat = device.getThermostatCapability();
  const targetTemp = overlay.setting.power === 'ON' ? overlay.setting.temperature.celsius : 0;

  await thermostat.setTargetTemperatureState(targetTemp, new Date());
}

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
        const response = await client.setHeatingPowerForZone(device.providerId, value === null ? false : value, false);

        await updateTargetTemperatureFromOverlay(device, response);
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
      },

      async getNextScheduledChange(device: Device): Promise<ScheduledChange | null> {
        let nextScheduleChange = nextScheduledChangeCache.get(device.providerId);

        if (nextScheduleChange === undefined || (nextScheduleChange && nextScheduleChange.start < new Date().toISOString())) {
          const client = new TadoClient(await getAccessToken(), config.tado.home_id);
          const zonesState = await client.getZonesState();
          const zoneState = zonesState[Number(device.providerId)];

          nextScheduleChange = zoneState.nextScheduleChange;
          nextScheduledChangeCache.set(device.providerId, nextScheduleChange);
        }

        if (nextScheduleChange?.setting.power === 'ON') {
          return {
            timestamp: new Date(nextScheduleChange.start),
            temperature: nextScheduleChange.setting.temperature.celsius
          };
        }

        return null;
      },

      async getScheduledTemperatureAtTime(device: Device, timestamp: Date): Promise<number | null> {
        let timetableBlocks = deviceTimetableCache.get(device.providerId);

        if (timetableBlocks === undefined) { 
          const client = new TadoClient(await getAccessToken(), config.tado.home_id);
          const activeTimetableId = await client.getActiveTimetableId(device.providerId);
          
          timetableBlocks = await client.getTimetableBlocks(device.providerId, activeTimetableId);
          deviceTimetableCache.set(device.providerId, timetableBlocks);
        }

        return getTimetabledTemperature(timetableBlocks, dayjs(timestamp));
      }
    };
  },

  async synchronize() {
    const client = new TadoClient(await getAccessToken(), config.tado.home_id);
    const zones = await client.getZones();

    for (const zone of zones) {
      if (zone.type === 'HEATING') {
        const zoneId = String(zone.id);
        const hasLowBattery = zone.devices.some(d => d.batteryState === 'LOW');
        let knownDevice = await Device.findByProviderId('tado', zoneId);

        if (!knownDevice) {
          knownDevice = Device.build({
            provider: 'tado',
            providerId: zoneId
          });
        }

        knownDevice.manufacturer = 'tado';
        knownDevice.model = zone.devices[0]?.deviceType ?? 'Unknown';
        knownDevice.name = `${zone.name} Thermostat`;

        await knownDevice.save();
        await knownDevice.getThermostatCapability().setSetbackTemperatureState(await client.getMinimumAwayTemperatureForZone(zoneId));
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
