import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import config from '../config';
import { User } from '../models';
import { markUserAsHome, markUserAsAway } from '../helpers/presence';

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
  await markUserAsHome(res.locals.user);

  res.sendStatus(200);
}));

router.post('/exit', asyncWrapper(async (req, res) => {
  await markUserAsAway(res.locals.user);

  res.sendStatus(200);
}));

export default router;