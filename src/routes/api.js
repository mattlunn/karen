import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import { HOME, AWAY } from '../constants/status';
import { User, Heating, Event, Recording, Stay } from '../models';
import { makeSynologyRequest } from '../services/synology';
import { getLightsAndStatus as getLightsAndStatusFromLightwave } from '../services/lightwaverf';
import { getLightsAndStatus as getLightsAndStatusFromTpLink, turnLightOnOrOff } from '../services/tplink';
import { getHeatingStatus, getOccupancyStatus, setTargetTemperature } from '../services/nest';
import moment from 'moment';
import s3 from '../services/s3';
import auth from '../middleware/auth';
import { setLightFeatureValue } from '../services/lightwaverf';

const router = express.Router();

router.use(auth);

function createResponseForStatus(user, upcoming, currentOrLast) {
  const withUser = () => ({ handle: user.handle, id: user.id, avatar: user.avatar });

  if (upcoming || currentOrLast.departure) {
    return {
      ...withUser(),

      status: AWAY,
      since: currentOrLast.departure,
      until: upcoming ? upcoming.eta : null
    };
  } else {
    return {
      ...withUser(),

      status: HOME,
      since: currentOrLast.arrival
    };
  }
}

router.get('/status', asyncWrapper(async (req, res) => {
  const users = await User.findAll();
  const userStatus = await Promise.all(users.map(async (user) => {
    const [upcoming, currentOrLast] = await Promise.all([
      Stay.findUpcomingStay(user.id),
      Stay.findCurrentOrLastStay(user.id)
    ]);

    return createResponseForStatus(user, upcoming, currentOrLast);
  }));

  res.json({
    stays: userStatus
  }).end();
}));

router.post('/eta', asyncWrapper(async (req, res, next) => {
  const user = await User.findByHandle(req.body.handle);

  if (user) {
    res.locals.user = user;
    next();
  } else {
    throw new Error(`${req.body.handle} is not a known user`);
  }
}), asyncWrapper(async (req, res) => {
  const user = res.locals.user;
  const eta = moment(req.body.eta);

  let [current, upcoming] = await Promise.all([
    Stay.findCurrentOrLastStay(user.id),
    Stay.findUpcomingStay(user.id)
  ]);

  if (current.departure === null) {
    throw new Error(`${req.body.handle} is currently at home. User must be away to set an ETA`);
  }

  if (eta.isBefore(moment())) {
    throw new Error(`ETA (${req.body.eta}) cannot be before the current time`);
  }

  if (!upcoming) {
    upcoming = new Stay();
    upcoming.userId = user.id;
  }

  upcoming.eta = eta;
  upcoming.etaSentToNestAt = null;

  await upcoming.save();

  res.json(createResponseForStatus(user, upcoming, current)).end();
}));

router.post('/status', asyncWrapper(async (req, res, next) => {
  const user = await User.findByHandle(req.body.handle);

  if (user) {
    res.locals.user = user;
    next();
  } else {
    throw new Error(`${req.body.handle} is not a known user`);
  }
}), asyncWrapper(async (req, res) => {
  const user = res.locals.user;
  const status = req.body.status;

  let [current, upcoming] = await Promise.all([
    Stay.findCurrentOrLastStay(user.id),
    Stay.findUpcomingStay(user.id)
  ]);

  switch (status) {
    case HOME:
      if (current.departure !== null) {
        if (!upcoming) {
          upcoming = new Stay();
          upcoming.userId = user.id;
        }

        upcoming.arrival = new Date();

        current = upcoming;
        upcoming = null;

        await current.save();
      }

      break;
    case AWAY:
      if (current.departure === null) {
        current.departure = new Date();
        await current.save();
      }

      break;
  }

  res.json(createResponseForStatus(user, upcoming, current)).end();
}));

router.get('/security', asyncWrapper(async (req, res) => {
  const [
    cameras,
    homeMode
  ] = await Promise.all([
    makeSynologyRequest('SYNO.SurveillanceStation.Camera', 'List'),
    makeSynologyRequest('SYNO.SurveillanceStation.HomeMode', 'GetInfo')
  ]);

  res.json({
    cameras: cameras.data.cameras.map((camera) => ({
      snapshot: `${req.protocol}://${req.headers.host}${req.baseUrl}/snapshot/${camera.id}`,
      id: camera.id,
      name: camera.newName
    })),

    isInHomeMode: homeMode.data.on
  });
}));

router.get('/snapshot/:id', asyncWrapper(async (req, res) => {
  res.type('jpeg').end(await makeSynologyRequest('SYNO.SurveillanceStation.Camera', 'GetSnapshot', {
    cameraId: req.params.id
  }, false, 8));
}));

router.get('/heating', asyncWrapper(async (req, res) => {
  res.json({
    ...getHeatingStatus(),
    ...getOccupancyStatus(),

    history: await Heating.getDailyHeatMap()
  });
}));

router.post('/temperature', asyncWrapper(async (req, res) => {
  await setTargetTemperature(req.body.target_temperature);

  res.sendStatus(200);
}));

router.get('/lighting', asyncWrapper(async (req, res) => {
  const lights = await Promise.all([
    getLightsAndStatusFromLightwave(),
    getLightsAndStatusFromTpLink()
  ]);

  res.json({
    lights: [].concat(...lights)
  });
}));

router.post('/light', asyncWrapper(async (req, res) => {
  switch (req.body.type) {
    case 'lightwaverf':
      await setLightFeatureValue(req.body.featureId, req.body.value);
      break;
    case 'tplink':
      await turnLightOnOrOff(req.body.featureId, req.body.value);
  }

  const lights = await Promise.all([
    getLightsAndStatusFromLightwave(),
    getLightsAndStatusFromTpLink()
  ]);

  res.json({
    lights: [].concat(...lights)
  });
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