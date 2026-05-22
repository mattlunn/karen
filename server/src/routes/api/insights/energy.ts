import { Device } from '../../../models';
import { Request, Response } from 'express';
import { EnergyInsightsApiResponse } from '../../../api/types';
import { convertPenceToPounds, mapNumericHistoryToResponse } from '../history-helpers';
import { awaitPromises } from '../../../helpers/promises';
import { asyncMap } from '../../../helpers/array';

export default async function (req: Request, res: Response) {
  const usageSelector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const costSelector = {
    since: new Date(req.query.costSince as string),
    until: new Date(req.query.costUntil as string)
  };

  const devices = await Device.findByCapability('ENERGY_MONITOR');

  res.json(await awaitPromises({
    usage: asyncMap(devices, async (device) => {
      const energyMonitor = device.getEnergyMonitorCapability();

      return {
        data: await mapNumericHistoryToResponse((hs) => energyMonitor.getCurrentPowerHistory(hs), usageSelector),
        label: device.name,
        deviceId: device.id,
        deviceName: device.name
      };
    }),
    cost: asyncMap(devices, async (device) => {
      const energyMonitor = device.getEnergyMonitorCapability();

      return {
        data: convertPenceToPounds(await mapNumericHistoryToResponse((hs) => energyMonitor.getDayCostHistory(hs), costSelector)),
        label: device.name,
        deviceId: device.id,
        deviceName: device.name
      };
    })
  }) satisfies EnergyInsightsApiResponse);
}
