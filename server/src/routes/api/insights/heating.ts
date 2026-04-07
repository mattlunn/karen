import { Device } from '../../../models';
import { Request, Response } from 'express';
import { HeatingInsightsApiResponse } from '../../../api/types';
import { mapNumericHistoryToResponse, mapEnumHistoryToResponse } from '../history-helpers';

export default async function (req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const [thermostats, heatpumps] = await Promise.all([
    Device.findByCapability('THERMOSTAT'),
    Device.findByCapability('HEAT_PUMP')
  ]);

  const heatpump = heatpumps[0].getHeatPumpCapability();

  const [lines, modesData] = await Promise.all([
    Promise.all(
      thermostats.map(async (device) => {
        const thermostat = device.getThermostatCapability();
        const data = await mapNumericHistoryToResponse(
          (hs) => thermostat.getPowerHistory(hs),
          selector
        );

        return { data, label: device.name, deviceName: device.name, yAxisID: 'yPercentage' };
      })
    ),
    mapEnumHistoryToResponse(
      (hs) => heatpump.getModeHistory(hs),
      selector,
      { 0: 'UNKNOWN', 1: 'STANDBY', 2: 'HEATING', 3: 'DHW', 4: 'DEICING', 5: 'FROST_PROTECTION' }
    )
  ]);

  const response: HeatingInsightsApiResponse = {
    lines,
    modes: {
      data: modesData,
      details: [
        { value: 'HEATING', label: 'Heating' },
        { value: 'DEICING', label: 'Deicing' },
        { value: 'FROST_PROTECTION', label: 'Frost Protection' },
        { value: 'DHW', label: 'Hot Water' }
      ]
    }
  };

  res.json(response);
}
