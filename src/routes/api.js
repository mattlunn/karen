import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import { User, Event, Recording, Stay } from '../models';
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
  const events = await Promise.all([
    Event.findAll({
      include: [
        Recording
      ],
      order: [['createdAt', 'DESC']],
      where: {
        createdAt: {
          $lt: since
        }
      },
      limit
    }).then((events) => {
      return events.map((event) => {
        return {
          id: event.id,
          timestamp: event.timestamp,
          recordingId: event.recording && event.recording.id,
          type: 'motion'
        };
      })
    }),

    Stay.findAll({
      where: {
        arrival: {
          $lt: since
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
          $lt: since
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
    })
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
  })

  return s3.serve(recording.recording, range.start, range.end).then((file) => {
    res.end(file);
  });
}));

export default router;