import { Device, NumericEvent } from '../../../models';
import { Request, Response } from 'express';
import { HeatingInsightsApiResponse, HistoryDetailsApiResponse, NumericEventApiResponse } from '../../../api/types';
import { TimeRangeSelector } from '../../../models/capabilities/helpers';
import { mapNumericHistoryToResponse, mapStringHistoryToResponse } from '../history-helpers';
import { awaitPromises } from '../../../helpers/promises';
import { asyncMap } from '../../../helpers/array';
import automations from '../../../config/automations.json';

function findEventAt(events: NumericEvent[], t: number): NumericEvent | null {
  // Events are ordered newest-first (DESC). Iterate that way so that if a stale
  // event with end=null exists alongside a newer active event, the newer one wins.
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.start.getTime() <= t && (e.end === null || e.end.getTime() > t)) {
      return e;
    }
  }
  return null;
}

function computeTemperatureDelta(
  currentEvents: NumericEvent[],
  targetEvents: NumericEvent[],
  selector: TimeRangeSelector
): HistoryDetailsApiResponse<NumericEventApiResponse> {
  const since = selector.since.getTime();
  const until = selector.until.getTime();
  const changePoints = new Set<number>();

  for (const e of currentEvents) changePoints.add(Math.max(e.start.getTime(), since));
  for (const e of targetEvents) changePoints.add(Math.max(e.start.getTime(), since));

  const sorted = [...changePoints].sort((a, b) => a - b);
  const history: NumericEventApiResponse[] = [];

  for (let k = 0; k < sorted.length; k++) {
    const segStart = sorted[k];
    if (segStart >= until) break;

    const segEnd = k + 1 < sorted.length ? Math.min(sorted[k + 1], until) : until;
    const cur = findEventAt(currentEvents, segStart);
    const tgt = findEventAt(targetEvents, segStart);

    if (cur && tgt) {
      history.push({
        start: new Date(segStart).toISOString(),
        end: new Date(segEnd).toISOString(),
        lastReported: new Date(Math.max(cur.lastReported.getTime(), tgt.lastReported.getTime())).toISOString(),
        value: Number((cur.value - tgt.value).toFixed(2))
      });
    }
  }

  return {
    history,
    since: selector.since.toISOString(),
    until: selector.until.toISOString()
  };
}

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

  const heatingAutomation = automations.find((a) => a.name === 'heating');
  const switchOnThreshold = heatingAutomation?.parameters?.temperatureDeltaSwitchOnThreshold;

  res.json(await awaitPromises({
    lines: asyncMap(thermostats, async (device) => {
      const thermostat = device.getThermostatCapability();
      const [data, isPassive] = await Promise.all([
        mapNumericHistoryToResponse((hs) => thermostat.getPowerHistory(hs), selector),
        thermostat.getIsPassive()
      ]);

      return {
        data,
        label: device.name,
        deviceName: device.name,
        yAxisID: 'yPercentage',
        borderDash: isPassive ? [5, 5] : undefined
      };
    }),
    modes: awaitPromises({
      data: mapStringHistoryToResponse(
        (hs) => heatpump.getModeHistory(hs),
        selector
      ),
      details: [
        { value: 'HEATING', label: 'Heating' },
        { value: 'DEICING', label: 'Deicing' },
        { value: 'FROST_PROTECTION', label: 'Frost Protection' },
        { value: 'DHW', label: 'Hot Water' }
      ]
    }),
    temperatures: asyncMap(thermostats, async (device) => {
      const thermostat = device.getThermostatCapability();
      const [data, isPassive] = await Promise.all([
        mapNumericHistoryToResponse((hs) => thermostat.getCurrentTemperatureHistory(hs), selector),
        thermostat.getIsPassive()
      ]);

      return {
        data,
        label: device.name,
        deviceName: device.name,
        yAxisID: 'yTemperature',
        borderDash: isPassive ? [5, 5] : undefined
      };
    }),
    temperatureDeltas: asyncMap(thermostats, async (device) => {
      const thermostat = device.getThermostatCapability();
      const [currentEvents, targetEvents, isPassive] = await Promise.all([
        thermostat.getCurrentTemperatureHistory(selector),
        thermostat.getTargetTemperatureHistory(selector),
        thermostat.getIsPassive()
      ]);

      return {
        data: computeTemperatureDelta(currentEvents, targetEvents, selector),
        label: device.name,
        deviceName: device.name,
        yAxisID: 'yDelta',
        borderDash: isPassive ? [5, 5] : undefined
      };
    }),
    heatPump: { id: heatpumps[0].id, name: heatpumps[0].name },
    temperatureDeltaSwitchOnThreshold: typeof switchOnThreshold === 'number' ? switchOnThreshold : null
  }) satisfies HeatingInsightsApiResponse);
}
