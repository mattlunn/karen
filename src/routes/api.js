import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import { User, Event, Recording, Stay, Device, Op } from '../models';
import { makeSynologyRequest } from '../services/synology';
import moment from 'moment';
import s3 from '../services/s3';
import auth from '../middleware/auth';

const router = express.Router();

router.use(auth);

router.get('/snapshot/:id', asyncWrapper(async (req, res) => {
  res.type('jpeg').end(await makeSynologyRequest('SYNO.SurveillanceStation.Camera', 'GetSnapshot', {
    cameraId: req.params.id
  }, false, 8));
}));

router.get('/timeline', asyncWrapper(async (req, res) => {
  const since = req.query.after || new Date();
  const limit = 100;
  const devices = (await Device.findAll()).reduce((map, curr) => {
    map.set(curr.id, curr);

    return map;
  }, new Map());

  const events = await Promise.all([
    Event.findAll({
      include: [
        Recording,
        Device
      ],
      order: [['start', 'DESC']],
      where: {
        start: {
          [Op.lt]: since
        },
        type: 'motion'
      },
      limit
    }).then((events) => {
      return events.map((event) => {
        return {
          id: event.id,
          timestamp: event.start,
          recordingId: event.recording && event.recording.id,
          type: 'motion',
          deviceName: event.device.name
        };
      });
    }),

    Stay.findAll({
      where: {
        arrival: {
          [Op.lt]: since
        }
      },

      include: [
        User
      ],

      limit,
      order: [['arrival', 'DESC']],
    }).then((arrivals) => {
      return arrivals.map((stay) => {
        return {
          timestamp: stay.arrival,
          user: stay.user.handle,
          type: 'arrival'
        };
      });
    }),

    Stay.findAll({
      where: {
        departure: {
          [Op.lt]: since
        }
      },

      include: [
        User
      ],

      limit,
      order: [['departure', 'DESC']],
    }).then((departures) => {
      return departures.map((stay) => {
        return {
          timestamp: stay.departure,
          user: stay.user.handle,
          type: 'departure'
        };
      });
    }),

    Event.findAll({
      order: [['start', 'DESC']],
      where: {
        start: {
          [Op.lt]: since
        },
        type: 'on'
      },
      limit
    }).then((events) => {
      return events.map((event) => {
        const ret = [{
          id: `${event.id}-on`,
          timestamp: event.start,
          device: devices.get(+event.deviceId).name,
          type: 'light_on'
        }];

        if (event.end) {
          ret.push({
            id: `${event.id}-off`,
            timestamp: event.end,
            device: devices.get(+event.deviceId).name,
            duration: event.end - event.start,
            type: 'light_off'
          });
        }

        return ret;
      }).flat();
    }),
  ]);

  const allEvents = [].concat(...events);

  allEvents.sort((a, b) => {
    return b.timestamp - a.timestamp;
  });

  res.json({
    events: allEvents.slice(0, 100)
  });
}));

router.get('/recording/:id', asyncWrapper(async function (req, res) {
  const recording = await Recording.findOne({
    where: {
      id: req.params.id
    },
    include: [Event]
  });

  if (recording == null)
    throw new Error('route');

  const ranges = req.range(recording.size);
  let status;
  let range;

  if (ranges && ranges.length === 1) {
    range = ranges[0];
    status = 206;
  } else {
    status = 200;
    range = {
      start: 0,
      end: recording.size - 1
    };
  }

  const chunk = range.end - range.start;

  if (req.query.download === 'true') {
    res.set('Content-disposition', 'attachment; filename=' + moment(recording.event.timestamp).format('YYYY-MM-DD HH:mm:ss') + '.mp4');
  }

  res.writeHead(status, {
    'Accept-Ranges': 'bytes',
    'Content-Type': 'video/mp4',
    'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + recording.size,
    'Content-Length': chunk + 1
  });

  return s3.serve(recording.recording, range.start, range.end).then((file) => {
    res.end(file);
  });
}));

export default router;