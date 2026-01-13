import { Device } from '../../../models';
import expressAsyncWrapper from '../../../helpers/express-async-wrapper';
import dayjs from '../../../dayjs';
import { mapBooleanHistoryToResponse, mapEnumHistoryToResponse } from './history-registry';

export type TimelineEventResponse = {
  type: 'light-on' | 'light-off' | 'motion-start' | 'motion-end' | 'heatpump-mode';
  timestamp: string;
  value?: string;
};

export type TimelineResponse = {
  since: string;
  until: string;
  events: TimelineEventResponse[];
};

export default expressAsyncWrapper(async function (req, res, next) {
  const deviceId = req.params.id;
  const sinceParam = req.query.since as string | undefined;
  const untilParam = req.query.until as string | undefined;

  const device = await Device.findById(deviceId);

  if (!device) {
    return next('route');
  }

  const historySelector = {
    since: sinceParam ? new Date(sinceParam) : dayjs().startOf('day').toDate(),
    until: untilParam ? new Date(untilParam) : new Date()
  };

  // Validate dates
  if (isNaN(historySelector.since.getTime()) || isNaN(historySelector.until.getTime())) {
    return res.status(400).json({ error: 'Invalid date format. Use ISO 8601.' });
  }

  if (historySelector.since > historySelector.until) {
    return res.status(400).json({ error: 'since must be before until' });
  }

  const events: TimelineEventResponse[] = [];
  const capabilities = device.getCapabilities();

  for (const capability of capabilities) {
    switch (capability) {
      case 'LIGHT': {
        const light = await device.getLightCapability();
        const isOnHistory = await mapBooleanHistoryToResponse(
          (hs) => light.getIsOnHistory(hs),
          historySelector
        );

        for (const event of isOnHistory.history) {
          events.push({
            type: 'light-on',
            timestamp: event.start
          });

          if (event.end) {
            events.push({
              type: 'light-off',
              timestamp: event.end
            });
          }
        }
        break;
      }

      case 'MOTION_SENSOR': {
        const sensor = await device.getMotionSensorCapability();
        const hasMotionHistory = await mapBooleanHistoryToResponse(
          (hs) => sensor.getHasMotionHistory(hs),
          historySelector
        );

        for (const event of hasMotionHistory.history) {
          events.push({
            type: 'motion-start',
            timestamp: event.start
          });

          if (event.end) {
            events.push({
              type: 'motion-end',
              timestamp: event.end
            });
          }
        }
        break;
      }

      case 'HEAT_PUMP': {
        const heatPump = await device.getHeatPumpCapability();
        const modeHistory = await mapEnumHistoryToResponse(
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
        );

        for (const event of modeHistory.history) {
          events.push({
            type: 'heatpump-mode',
            timestamp: event.start,
            value: event.value
          });
        }
        break;
      }
    }
  }

  // Sort events by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const response: TimelineResponse = {
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString(),
    events
  };

  res.json(response);
});
