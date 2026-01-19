import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Event, Stay, Arming, Device, Recording, User, Op } from '../../models';
import { TimelineFeedEvent, TimelineFeedApiResponse } from '../../api/types';

const router = express.Router();

interface EventWithTimestamp {
  event: TimelineFeedEvent;
  timestamp: number;
}

router.get('/', asyncWrapper(async (req, res) => {
  const since = Number(req.query.since) || Date.now();
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const deviceCache = new Map<number, Device>();

  async function getDevice(deviceId: number): Promise<Device | null> {
    if (deviceCache.has(deviceId)) {
      return deviceCache.get(deviceId)!;
    }
    const device = await Device.findById(String(deviceId));
    if (device) {
      deviceCache.set(deviceId, device);
    }
    return device;
  }

  const [dbEvents, arrivals, departures, armings, recordings] = await Promise.all([
    Event.findAll({
      order: [['start', 'DESC']],
      where: {
        start: { [Op.lt]: since },
        type: { [Op.in]: ['motion', 'on', 'ring'] }
      },
      limit
    }),

    Stay.findAll({
      where: { arrival: { [Op.lt]: since } },
      limit,
      order: [['arrival', 'DESC']]
    }),

    Stay.findAll({
      where: { departure: { [Op.lt]: since, [Op.not]: null } },
      limit,
      order: [['departure', 'DESC']]
    }),

    Arming.findAll({
      order: [['start', 'DESC']],
      where: { start: { [Op.lt]: since } },
      limit
    }),

    Recording.findAll({
      where: {},
      include: [Event]
    })
  ]);

  const allUserIds = new Set<number>();
  arrivals.forEach(stay => { if (stay.userId) allUserIds.add(stay.userId as number); });
  departures.forEach(stay => { if (stay.userId) allUserIds.add(stay.userId as number); });

  const users = await User.findAllById(Array.from(allUserIds));
  const usersById = new Map(users.map(u => [u.id, u]));

  const recordingsByEventId = new Map<number, Recording>();
  recordings.forEach(recording => {
    recordingsByEventId.set(recording.eventId, recording);
  });

  const allEvents: EventWithTimestamp[] = [];

  for (const event of dbEvents) {
    const device = await getDevice(event.deviceId);
    if (!device) continue;

    switch (event.type) {
      case 'motion': {
        const recording = recordingsByEventId.get(event.id);
        allEvents.push({
          timestamp: +event.start,
          event: {
            type: 'motion',
            id: event.id,
            timestamp: +event.start,
            deviceId: device.id,
            deviceName: device.name,
            recordingId: recording?.id ?? null
          }
        });
        break;
      }

      case 'on': {
        allEvents.push({
          timestamp: +event.start,
          event: {
            type: 'light-on',
            id: event.id,
            timestamp: +event.start,
            deviceId: device.id,
            deviceName: device.name
          }
        });

        if (event.end) {
          const duration = +event.end - +event.start;
          allEvents.push({
            timestamp: +event.end,
            event: {
              type: 'light-off',
              id: event.id,
              timestamp: +event.end,
              deviceId: device.id,
              deviceName: device.name,
              duration
            }
          });
        }
        break;
      }

      case 'ring': {
        allEvents.push({
          timestamp: +event.start,
          event: {
            type: 'doorbell-ring',
            id: event.id,
            timestamp: +event.start
          }
        });
        break;
      }
    }
  }

  for (const stay of arrivals) {
    const user = stay.userId ? usersById.get(stay.userId as number) : null;
    if (stay.arrival && user) {
      allEvents.push({
        timestamp: +stay.arrival,
        event: {
          type: 'arrival',
          id: stay.id as number,
          timestamp: +stay.arrival,
          userId: user.handle
        }
      });
    }
  }

  for (const stay of departures) {
    const user = stay.userId ? usersById.get(stay.userId as number) : null;
    if (stay.departure && user) {
      allEvents.push({
        timestamp: +stay.departure,
        event: {
          type: 'departure',
          id: stay.id as number,
          timestamp: +stay.departure,
          userId: user.handle
        }
      });
    }
  }

  for (const arming of armings) {
    allEvents.push({
      timestamp: +arming.start,
      event: {
        type: 'alarm-arming',
        id: arming.id,
        timestamp: +arming.start,
        mode: arming.mode as 'OFF' | 'AWAY' | 'NIGHT'
      }
    });

    if (arming.end) {
      allEvents.push({
        timestamp: +arming.end,
        event: {
          type: 'alarm-arming',
          id: arming.id,
          timestamp: +arming.end,
          mode: 'OFF'
        }
      });
    }
  }

  allEvents.sort((a, b) => b.timestamp - a.timestamp);

  const limitedEvents = allEvents.slice(0, limit);
  const hasMore = allEvents.length > limit;

  const response: TimelineFeedApiResponse = {
    events: limitedEvents.map(e => e.event),
    hasMore
  };

  res.json(response);
}));

export default router;
