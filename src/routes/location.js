import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import config from '../config';
import { Stay, User } from '../models';
import moment from 'moment';

const router = express.Router();

router.use(asyncWrapper(async (req, res, next) => {
  if (req.query.client_id !== config.location.client_id) {
    return next(new Error('Invalid client_id'));
  }

  const user = await User.findByHandle(req.query.user);

  if (user === null) {
    return next(new Error('Invalid user'));
  }

  res.locals.user = user;
  next();
}));

router.post('/enter', asyncWrapper(async (req, res) => {
  const userId = res.locals.user.id;
  let [current, upcoming] = await Promise.all([
    Stay.findCurrentStay(userId),
    Stay.findUpcomingStay(userId)
  ]);

  if (current) {
    throw new Error(`/enter called for ${res.locals.user.handle}, but user is already at home`);
  } else {
    if (!upcoming) {
      upcoming = new Stay({
        userId
      });
    }

    upcoming.arrival = new Date();
    await upcoming.save();

    res.sendStatus(200);
  }
}));

router.post('/exit', asyncWrapper(async (req, res) => {
  const userId = res.locals.user.id;
  let [ current, unclaimedEta ] = await Promise.all([
    Stay.findCurrentStay(userId),
    Stay.findUnclaimedEta(moment().subtract(config.location.unclaimed_eta_search_window_in_minutes, 'minutes'))
  ]);

  if (!current) {
    throw new Error(`/exit called for ${res.locals.user.handle}, but user isn't at home`);
  } else {
    current.departure = new Date();

    await current.save();
    res.sendStatus(200);

    if (unclaimedEta) {
      console.log(`${res.locals.user.handle} claims ETA ${unclaimedEta.id}`);

      unclaimedEta.userId = userId;

      await unclaimedEta.save();
    } else if (current.eta !== null && moment(current.eta).isAfter(current.departure)) {
      console.log(`Exit for ${res.locals.user.handle} in stay ${current.id}`
       + ` is before the ETA, and there is no upcoming unclaimed ETA. Assuming `
       + ` user went near to home, without actually going in...`);

      unclaimedEta = new Stay();
      unclaimedEta.userId = userId;
      unclaimedEta.eta = current.eta;

      await unclaimedEta.save();
    }
  }
}));

export default router;