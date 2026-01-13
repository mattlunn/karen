import { Device } from '../../../models';
import expressAsyncWrapper from '../../../helpers/express-async-wrapper';
import dayjs from '../../../dayjs';
import { mapBooleanHistoryToResponse, mapEnumHistoryToResponse } from './history-registry';
import { TimelineApiResponse, TimelineEventApiResponse } from '../../../api/types';

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

  const events: TimelineEventApiResponse[] = [];

  for (const capability of device.getCapabilities()) {
    switch (capability) {
      case 'LIGHT': {
        const light = device.getLightCapability();
        const isOnHistory = await mapBooleanHistoryToResponse(
          (hs) => light.getIsOnHistory(hs),
          historySelector
        );

        for (const event of isOnHistory.history) {
          events.push({ type: 'light-on', timestamp: event.start });
          if (event.end) {
            events.push({ type: 'light-off', timestamp: event.end });
          }
        }
        break;
      }

      case 'MOTION_SENSOR': {
        const sensor = device.getMotionSensorCapability();
        const hasMotionHistory = await mapBooleanHistoryToResponse(
          (hs) => sensor.getHasMotionHistory(hs),
          historySelector
        );

        for (const event of hasMotionHistory.history) {
          events.push({ type: 'motion-start', timestamp: event.start });
          if (event.end) {
            events.push({ type: 'motion-end', timestamp: event.end });
          }
        }
        break;
      }

      case 'HEAT_PUMP': {
        const heatPump = device.getHeatPumpCapability();
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
          events.push({ type: 'heatpump-mode', timestamp: event.start, value: event.value });
        }
        break;
      }
    }
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({
    since: historySelector.since.toISOString(),
    until: historySelector.until.toISOString(),
    events
  } satisfies TimelineApiResponse);
});
