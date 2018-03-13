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
  let [currents, upcoming] = await Promise.all([
    Stay.findCurrentStays(),
    Stay.findUpcomingStay(userId)
  ]);

  if (currents.some(x => x.userId === userId)) {
    console.log(`/enter called for ${res.locals.user.handle}, but user is already at home`);
    res.sendStatus(500);
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
  const [ currents, unclaimedEta ] = await Promise.all([
    Stay.findCurrentStays(),
    Stay.findUnclaimedEta(moment().subtract(config.location.unclaimed_eta_search_window_in_minutes, 'minutes'))
  ]);

  const current = currents.find(x => x.userId === userId);

  if (!current) {
    console.log(`/exit called for ${res.locals.user.handle}, but user isn't at home`);
    res.sendStatus(500);
  } else {
    current.departure = new Date();

    await current.save();
    res.sendStatus(200);

    if (unclaimedEta) {
      console.log(`${res.locals.user.handle} claims ETA ${unclaimedEta.id}`);

      unclaimedEta.userId = userId;
      await unclaimedEta.save();
    }
  }
}));

export default router;