import { Request, Response } from 'express';
import { Device, Arming, Op } from '../../../models';
import { SecurityInsightsApiResponse } from '../../../api/types';
import { Capability } from '../../../models/capabilities';
import { HistorySelector } from '../../../models/capabilities/helpers';
import { asyncMap } from '../../../helpers/array';
import dayjs from '../../../dayjs';

const SECURITY_RELEVANT_CAPABILITIES: Capability[] = ['MOTION_SENSOR', 'CAMERA', 'CONTACT_SENSOR', 'LOCK', 'DOORBELL'];

export default async function (req: Request, res: Response) {
  const selector: HistorySelector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const [
    motionDevices,
    doorbellDevices,
    lockDevices,
    contactDevices,
    connectivityDevices,
    armingRows
  ] = await Promise.all([
    Device.findByCapability('MOTION_SENSOR'),
    Device.findByCapability('DOORBELL'),
    Device.findByCapability('LOCK'),
    Device.findByCapability('CONTACT_SENSOR'),
    Device.findByCapability('CONNECTIVITY'),
    Arming.findAll({
      where: {
        start: { [Op.lt]: selector.until },
        [Op.or]: [
          { end: null },
          { end: { [Op.gt]: selector.since } }
        ]
      },
      order: [['start', 'DESC']]
    })
  ]);

  // Motion history, per device, hydrated with the recording (if the source device is a camera).
  const motionEventLists = await asyncMap(motionDevices, async (device) => {
    const history = await device.getMotionSensorCapability().getHasMotionHistory(selector);

    return asyncMap(history, async (event) => {
      const recording = await event.getRecording();

      return {
        id: event.id,
        deviceId: device.id,
        deviceName: device.name,
        roomId: (device.roomId as number | null) ?? null,
        start: event.start.toISOString(),
        end: event.end?.toISOString() ?? null,
        recordingId: recording?.id ?? null
      };
    });
  });

  const motionEvents = motionEventLists.flat();

  // Boolean capability history only stores "on" segments (start/end pairs) - unpack each into
  // a "locked"/"unlocked" (or "open"/"closed") pair of timeline points, mirroring the way
  // routes/api/timeline.ts turns light 'on' events into light-on/light-off pairs.
  const lockEventLists = await asyncMap(lockDevices, async (device) => {
    const history = await device.getLockCapability().getIsLockedHistory(selector);
    const entries: SecurityInsightsApiResponse['lockEvents'] = [];

    for (const event of history) {
      entries.push({
        id: event.id,
        deviceId: device.id,
        deviceName: device.name,
        timestamp: event.start.toISOString(),
        isLocked: true
      });

      if (event.end) {
        entries.push({
          id: event.id,
          deviceId: device.id,
          deviceName: device.name,
          timestamp: event.end.toISOString(),
          isLocked: false
        });
      }
    }

    return entries;
  });

  const lockEvents = lockEventLists.flat();

  const contactEventLists = await asyncMap(contactDevices, async (device) => {
    const history = await device.getContactSensorCapability().getIsOpenHistory(selector);
    const entries: SecurityInsightsApiResponse['contactEvents'] = [];

    for (const event of history) {
      entries.push({
        id: event.id,
        deviceId: device.id,
        deviceName: device.name,
        timestamp: event.start.toISOString(),
        isOpen: true
      });

      if (event.end) {
        entries.push({
          id: event.id,
          deviceId: device.id,
          deviceName: device.name,
          timestamp: event.end.toISOString(),
          isOpen: false
        });
      }
    }

    return entries;
  });

  const contactEvents = contactEventLists.flat();

  const doorbellEventLists = await asyncMap(doorbellDevices, async (device) => {
    const history = await device.getDoorbellCapability().getRingHistory(selector);

    return history.map((event) => ({
      id: event.id,
      deviceId: device.id,
      deviceName: device.name,
      timestamp: event.start.toISOString(),
      hasThumbnail: true
    }));
  });

  const doorbellRings = doorbellEventLists.flat();

  // Connectivity offline/online, but only for devices that are also security-relevant -
  // connectivity for e.g. a light isn't interesting on this page.
  const securityRelevantConnectivityDevices = connectivityDevices.filter((device) =>
    device.getCapabilities().some((capability) => SECURITY_RELEVANT_CAPABILITIES.includes(capability))
  );

  const connectivityEventLists = await asyncMap(securityRelevantConnectivityDevices, async (device) => {
    const history = await device.getConnectivityCapability().getIsConnectedHistory(selector);
    const entries: SecurityInsightsApiResponse['connectivityEvents'] = [];

    for (const event of history) {
      entries.push({
        id: event.id,
        deviceId: device.id,
        deviceName: device.name,
        timestamp: event.start.toISOString(),
        isConnected: true
      });

      if (event.end) {
        entries.push({
          id: event.id,
          deviceId: device.id,
          deviceName: device.name,
          timestamp: event.end.toISOString(),
          isConnected: false
        });
      }
    }

    return entries;
  });

  const connectivityEvents = connectivityEventLists.flat();

  // Armings + their activations, overlapping the selected range.
  const armings = await asyncMap(armingRows, async (arming) => {
    const activationRows = await arming.getAlarmActivations();

    const activations = await asyncMap(activationRows, async (activation) => {
      const triggeringDevice = await activation.getTriggeringDevice();

      return {
        id: activation.id,
        startedAt: activation.startedAt.toISOString(),
        suppressFurtherAlertsUntil: activation.suppressFurtherAlertsUntil.toISOString(),
        triggeringDevice: { id: triggeringDevice.id, name: triggeringDevice.name }
      };
    });

    return {
      id: arming.id,
      mode: arming.mode as 'NIGHT' | 'AWAY',
      start: arming.start.toISOString(),
      end: arming.end ? arming.end.toISOString() : null,
      activations
    };
  });

  // Motion-by-device-hour heatmap, aggregated across every day in the selected range. Seed
  // every motion sensor up front so it still gets a row even with zero motion in the range.
  const motionByDeviceHour = new Map(motionDevices.map((device) =>
    [device.id, { deviceId: device.id, label: device.name, countByHour: new Array(24).fill(0) }]
  ));

  for (const event of motionEvents) {
    const hour = dayjs(event.start).hour();
    motionByDeviceHour.get(event.deviceId)!.countByHour[hour] += 1;
  }

  const response: SecurityInsightsApiResponse = {
    armings,
    motionEvents,
    lockEvents,
    contactEvents,
    doorbellRings,
    motionByDeviceHour: [...motionByDeviceHour.values()],
    connectivityEvents
  };

  res.json(response);
}
