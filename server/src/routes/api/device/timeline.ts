import { Device, BooleanEvent, NumericEvent } from '../../../models';
import expressAsyncWrapper from '../../../helpers/express-async-wrapper';
import dayjs from '../../../dayjs';
import { TimeRangeSelector, HistorySelector } from '../../../models/capabilities/helpers';
import { DeviceTimelineApiResponse, DeviceTimelineEventApiResponse } from '../../../api/types';

function mapBooleanHistory(
  fetchHistory: (hs: HistorySelector) => Promise<BooleanEvent[]>,
  historySelector: TimeRangeSelector
): Promise<{ start: string; end: string | null }[]> {
  return fetchHistory(historySelector).then(events =>
    events.map((event: BooleanEvent) => ({
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null
    }))
  );
}

function mapEnumHistory(
  fetchHistory: (hs: HistorySelector) => Promise<NumericEvent[]>,
  historySelector: TimeRangeSelector,
  map: Record<number, string>
): Promise<{ start: string; value: string }[]> {
  return fetchHistory(historySelector).then(events =>
    events.map((event: NumericEvent) => ({
      start: event.start.toISOString(),
      value: map[event.value]
    }))
  );
}

export default expressAsyncWrapper(async function (req, res, next) {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return next('route');
  }

  const sinceParam = req.query.since as string | undefined;
  const untilParam = req.query.until as string | undefined;

  const historySelector = {
    since: sinceParam ? new Date(sinceParam) : dayjs().startOf('day').toDate(),
    until: untilParam ? new Date(untilParam) : new Date()
  };

  const events: DeviceTimelineEventApiResponse[] = [];
  const historyPromises: Promise<void>[] = [];

  for (const capability of device.getCapabilities()) {
    switch (capability) {
      case 'LIGHT': {
        const light = device.getLightCapability();
        historyPromises.push(
          mapBooleanHistory((hs) => light.getIsOnHistory(hs), historySelector)
            .then(history => {
              for (const event of history) {
                events.push({ type: 'light-on', timestamp: event.start });
                if (event.end) {
                  events.push({ type: 'light-off', timestamp: event.end });
                }
              }
            })
        );
        break;
      }

      case 'MOTION_SENSOR': {
        const sensor = device.getMotionSensorCapability();
        historyPromises.push(
          mapBooleanHistory((hs) => sensor.getHasMotionHistory(hs), historySelector)
            .then(history => {
              for (const event of history) {
                events.push({ type: 'motion-start', timestamp: event.start });
                if (event.end) {
                  events.push({ type: 'motion-end', timestamp: event.end });
                }
              }
            })
        );
        break;
      }

      case 'HEAT_PUMP': {
        const heatPump = device.getHeatPumpCapability();
        historyPromises.push(
          mapEnumHistory(
            (hs) => heatPump.getModeHistory(hs),
            historySelector,
            {
              0: 'UNKNOWN',
              1: 'STANDBY',
              2: 'HEATING',
              3: 'DHW',
              4: 'DEICING',
              5: 'FROST_PROTECTION',
            }
          ).then(history => {
            for (const event of history) {
              events.push({ type: 'heatpump-mode', timestamp: event.start, value: event.value });
            }
          })
        );
        break;
      }
    }
  }

  await Promise.all(historyPromises);

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString(),
    events
  } satisfies DeviceTimelineApiResponse);
});
