import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import { Stay } from '../models';
import { HOME, AWAY } from '../constants/status';
import { User, Token } from '../models';
import { withSynology } from '../services/synology';
import moment from 'moment';

const router = express.Router();

router.post('/authenticate', asyncWrapper(async (req, res) => {
  const user = await User.findByCredentials(req.body.username, req.body.password);

  if (user) {
    res
      .send({
        username: user.handle,
        token: await Token.createForUser(user)
      })
      .end();
  } else {
    res
      .status(404)
      .end();
  }
}));

router.use(asyncWrapper(async (req, res, next) => {
  const token = (
    req.header('Authorization') || ''
  ).match(/^Bearer ([a-zA-Z0-9_=\/+]{1,255})$/);

  try {
    if (token !== null && await Token.isValid(token[1])) {
      return next();
    }
  } catch (e) {}

  res
    .status(401)
    .end();
}));

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
  const synology = await withSynology;
  const [
    cameras,
    homeMode
  ] = await Promise.all([
    synology.request('SYNO.SurveillanceStation.Camera', 'List').then((cameras) => {
      return Promise.all(cameras.data.cameras.map(async (camera) => {
        const snapshot = await synology.request('SYNO.SurveillanceStation.Camera', 'GetSnapshot', {
          cameraId: camera.id
        }, false, 8);

        return {
          snapshot: `data:image/jpeg;base64,${snapshot.toString('base64')}`,
          id: camera.id,
          name: camera.newName
        };
      }));
    }),

    synology.request('SYNO.SurveillanceStation.HomeMode', 'GetInfo')
  ]);

  res.json({
    cameras,
    isInHomeMode: homeMode.data.on
  });
}));

export default router;