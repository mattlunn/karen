import { Device, NumericEvent } from '../../../models';
import { TimeRangeSelector, HistorySelector } from '../../../models/capabilities/helpers';
import expressAsyncWrapper from '../../../helpers/express-async-wrapper';
import dayjs from '../../../dayjs';
import {
  EnumEventApiResponse,
  HistoryDetailsApiResponse,
  NumericEventApiResponse,
  HeatingInsightsApiResponse
} from '../../../api/types';

function mapNumericHistoryToResponse(
  fetchHistory: (hs: HistorySelector) => Promise<NumericEvent[]>,
  historySelector: TimeRangeSelector
): Promise<HistoryDetailsApiResponse<NumericEventApiResponse>> {
  return fetchHistory(historySelector).then(events => ({
    history: events.map((event: NumericEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: event.value
    })),
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString()
  }));
}

function mapEnumHistoryToResponse(
  fetchHistory: (hs: HistorySelector) => Promise<NumericEvent[]>,
  historySelector: TimeRangeSelector,
  map: Record<number, string>
): Promise<HistoryDetailsApiResponse<EnumEventApiResponse>> {
  return fetchHistory(historySelector).then(events => ({
    history: events.map((event: NumericEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      lastReported: event.lastReported.toISOString(),
      value: map[event.value]
    })),
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString()
  }));
}

export default expressAsyncWrapper(async function (req, res) {
  const sinceParam = req.query.since as string | undefined;
  const untilParam = req.query.until as string | undefined;

  const selector: TimeRangeSelector = {
    since: sinceParam ? new Date(sinceParam) : dayjs().startOf('day').toDate(),
    until: untilParam ? new Date(untilParam) : new Date()
  };

  const [thermostats, heatPumps] = await Promise.all([
    Device.findByCapability('THERMOSTAT'),
    Device.findByCapability('HEAT_PUMP')
  ]);

  const lines = await Promise.all(
    thermostats.map(async (device) => {
      const thermostat = device.getThermostatCapability();
      const data = await mapNumericHistoryToResponse(
        (hs) => thermostat.getPowerHistory(hs),
        selector
      );

      return {
        data,
        label: device.name,
        deviceName: device.name,
        yAxisID: 'yPercentage'
      };
    })
  );

  const response: HeatingInsightsApiResponse = { lines };

  if (heatPumps.length > 0) {
    const heatPump = heatPumps[0].getHeatPumpCapability();
    const modesData = await mapEnumHistoryToResponse(
      (hs) => heatPump.getModeHistory(hs),
      selector,
      {
        0: 'UNKNOWN',
        1: 'STANDBY',
        2: 'HEATING',
        3: 'DHW',
        4: 'DEICING',
        5: 'FROST_PROTECTION',
      }
    );

    response.modes = {
      data: modesData,
      details: [
        { value: 'HEATING', label: 'Heating' },
        { value: 'DEICING', label: 'Deicing' },
        { value: 'FROST_PROTECTION', label: 'Frost Protection' },
        { value: 'DHW', label: 'Hot Water' }
      ]
    };
  }

  res.json(response);
});
