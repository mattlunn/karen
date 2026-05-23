import { Device } from '../../../models';
import { Request, Response } from 'express';
import { EnergyInsightsApiResponse } from '../../../api/types';
import { mapNumericHistoryToResponse } from '../history-helpers';
import { awaitPromises } from '../../../helpers/promises';
import { asyncMap } from '../../../helpers/array';

export default async function (req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const [devices, thermostats] = await Promise.all([
    Device.findByCapability('ENERGY_MONITOR'),
    Device.findByCapability('THERMOSTAT')
  ]);

  res.json(await awaitPromises({
    usage: asyncMap(devices, async (device) => {
      const energyMonitor = device.getEnergyMonitorCapability();

      return {
        data: await mapNumericHistoryToResponse((hs) => energyMonitor.getCurrentPowerHistory(hs), selector),
        label: device.name,
        deviceId: device.id,
        deviceName: device.name
      };
    }),
    cost: asyncMap(devices, async (device) => {
      const energyMonitor = device.getEnergyMonitorCapability();

      return {
        data: await mapNumericHistoryToResponse((hs) => energyMonitor.getDayCostHistory(hs), selector),
        label: device.name,
        deviceId: device.id,
        deviceName: device.name
      };
    }),
    temperatures: asyncMap(thermostats, async (device) => {
      const thermostat = device.getThermostatCapability();

      return {
        data: await mapNumericHistoryToResponse((hs) => thermostat.getCurrentTemperatureHistory(hs), selector),
        label: device.name,
        deviceId: device.id,
        deviceName: device.name
      };
    })
  }) satisfies EnergyInsightsApiResponse);
}
