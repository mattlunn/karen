import { Device } from '../../../models';
import expressAsyncWrapper from '../../../helpers/express-async-wrapper';
import { HeatingInsightsApiResponse } from '../../../api/types';
import { mapNumericHistoryToResponse, mapEnumHistoryToResponse } from '../history-helpers';

export default expressAsyncWrapper(async function (req, res) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const [thermostats, heatpumps] = await Promise.all([
    Device.findByCapability('THERMOSTAT'),
    Device.findByCapability('HEAT_PUMP')
  ]);

  const heatpump = heatpumps[0].getHeatPumpCapability();

  const [thermostatRows, lines, modesData] = await Promise.all([
    Promise.all(
      thermostats.map(async (device) => {
        const thermostat = device.getThermostatCapability();
        const [targetTemperature, currentTemperature, power] = await Promise.all([
          thermostat.getTargetTemperature(),
          thermostat.getCurrentTemperature(),
          thermostat.getPower()
        ]);

        return { name: device.name, targetTemperature, currentTemperature, power };
      })
    ),
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
    thermostats: thermostatRows,
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
});
