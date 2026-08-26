import { Device, BooleanEvent, StringEvent } from '../../../models';
import { Request, Response, NextFunction } from 'express';
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

function mapStringHistory(
  fetchHistory: (hs: HistorySelector) => Promise<StringEvent[]>,
  historySelector: TimeRangeSelector
): Promise<{ start: string; value: string }[]> {
  return fetchHistory(historySelector).then(events =>
    events.map((event: StringEvent) => ({
      start: event.start.toISOString(),
      value: event.value
    }))
  );
}

export default async function (req: Request<{ id: string }>, res: Response, next: NextFunction) {
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
        for (const instance of device.getCapabilityInstances(capability)) {
          const sensor = device.getMotionSensorCapability(instance.id);

          historyPromises.push(
            mapBooleanHistory((hs) => sensor.getHasMotionHistory(hs), historySelector)
              .then(history => {
                for (const event of history) {
                  events.push({ type: 'motion-start', timestamp: event.start, instanceName: instance.name });
                  if (event.end) {
                    events.push({ type: 'motion-end', timestamp: event.end, instanceName: instance.name });
                  }
                }
              })
          );
        }
        break;
      }

      case 'BUTTON': {
        const button = device.getButtonCapability();
        historyPromises.push(
          mapBooleanHistory((hs) => button.getPressedHistory(hs), historySelector)
            .then(history => {
              for (const event of history) {
                events.push({ type: 'button-press', timestamp: event.start });
              }
            })
        );
        break;
      }

      case 'CONNECTIVITY': {
        const conn = device.getConnectivityCapability();
        historyPromises.push(
          conn.getIsConnectedHistory(historySelector).then(history => {
            for (const event of history) {
              events.push({ type: event.value ? 'connectivity-online' : 'connectivity-offline', timestamp: event.start.toISOString() });
            }
          })
        );
        break;
      }

      case 'CONTACT_SENSOR': {
        const sensor = device.getContactSensorCapability();
        historyPromises.push(
          sensor.getIsOpenHistory(historySelector).then(history => {
            for (const event of history) {
              if (event.value) {
                const durationSeconds = event.end
                  ? Math.round((event.end.getTime() - event.start.getTime()) / 1000)
                  : null;
                events.push({
                  type: 'contact-opened',
                  timestamp: event.start.toISOString(),
                  durationSeconds
                });
              }
            }
          })
        );
        break;
      }

      case 'SWITCH': {
        const switchCapability = device.getSwitchCapability();
        historyPromises.push(
          switchCapability.getIsOnHistory(historySelector).then(history => {
            for (const event of history) {
              events.push({ type: 'switch-on', timestamp: event.start.toISOString() });

              if (event.end) {
                const durationSeconds = Math.round((event.end.getTime() - event.start.getTime()) / 1000);

                events.push({ type: 'switch-off', timestamp: event.end.toISOString(), durationSeconds });
              }
            }
          })
        );
        break;
      }

      case 'HEAT_PUMP': {
        const heatPump = device.getHeatPumpCapability();
        historyPromises.push(
          mapStringHistory(
            (hs) => heatPump.getModeHistory(hs),
            historySelector
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
}
