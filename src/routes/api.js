import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import { Stay } from '../models';
import { HOME, AWAY } from '../constants/status';
import { User, Token } from '../models';
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

function createResponseForStatus(upcoming, currentOrLast) {
  if (upcoming || currentOrLast.departure) {
    return {
      status: AWAY,
      since: currentOrLast.departure,
      until: upcoming ? upcoming.eta : null
    };
  } else {
    return {
      status: HOME,
      since: currentOrLast.arrival
    };
  }
}

router.get('/status', asyncWrapper(async (req, res) => {
  const [upcoming, currentOrLast] = await Promise.all([
    Stay.findUpcomingStay(),
    Stay.findCurrentOrLastStay()
  ]);

  res.json(createResponseForStatus(upcoming, currentOrLast)).end();
}));

/*
 * { status: HOME } // I'm now home
 * { status: AWAY } // I'm now away
 * { status: AWAY, eta: XYZ }, I'm away until XYZ
 */
router.post('/status', asyncWrapper(async (req, res, next) => {
  let [upcoming, currentOrLast] = await Promise.all([
    Stay.findUpcomingStay(),
    Stay.findCurrentOrLastStay()
  ]);

  if (!req.body.status) {
    return next(new Error('You must specify a desired status'));
  }

  switch (req.body.status) {
    case HOME: {
      if (currentOrLast.departure) {
        currentOrLast = upcoming;
        upcoming = null;

        if (!currentOrLast) {
          currentOrLast = new Stay();
        }

        currentOrLast.arrival = new Date();
      }

      break;
    }
    case AWAY: {
      if (!currentOrLast.departure) {
        currentOrLast.departure = new Date();
      }

      if (req.body.eta) {
        const eta = moment(req.body.eta);

        if (!eta.isValid()) {
          return next(new Error(`${req.body.eta} is not in a recognised format`));
        }

        if (!upcoming) {
          upcoming = new Stay();
        }

        upcoming.eta = eta;
      }

      break;
    }
    default:
      return next(new Error(`'${req.body.status} is not a recognised status`));
  }

  await Promise.all([ upcoming, currentOrLast ].filter(x => x).map(x => x.save()));
  res.json(createResponseForStatus(upcoming, currentOrLast)).end();
}));

export default router;