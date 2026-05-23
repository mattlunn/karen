import { Device } from '../../../models';
import { Request, Response } from 'express';
import { EnergyInsightsSeriesApiResponse } from '../../../api/types';
import { convertPenceToPounds, mapNumericHistoryToResponse } from '../history-helpers';
import { asyncMap } from '../../../helpers/array';

export async function usageHandler(req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const devices = await Device.findByCapability('ENERGY_MONITOR');

  res.json({
    series: await asyncMap(devices, async (device) => {
      const energyMonitor = device.getEnergyMonitorCapability();

      return {
        data: await mapNumericHistoryToResponse((hs) => energyMonitor.getCurrentPowerHistory(hs), selector),
        label: device.name,
        deviceId: device.id,
        deviceName: device.name
      };
    })
  } satisfies EnergyInsightsSeriesApiResponse);
}

export async function costHandler(req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const devices = await Device.findByCapability('ENERGY_MONITOR');

  res.json({
    series: await asyncMap(devices, async (device) => {
      const energyMonitor = device.getEnergyMonitorCapability();

      return {
        data: convertPenceToPounds(await mapNumericHistoryToResponse((hs) => energyMonitor.getDayCostHistory(hs), selector)),
        label: device.name,
        deviceId: device.id,
        deviceName: device.name
      };
    })
  } satisfies EnergyInsightsSeriesApiResponse);
}
