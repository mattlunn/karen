import express from 'express';
import config from '../config';
import { User } from '../models';
import { markUserAsHome } from '../helpers/presence';

const router = express.Router();

router.use(async (req, res, next) => {
  if (req.query.client_id !== config.location.client_id) {
    return next(new Error('Invalid client_id'));
  }

  const [user] = await User.findByHandles([req.query.user]);

  if (user === undefined) {
    return next(new Error('Invalid user'));
  }

  res.locals.user = user;
  next();
});

router.post('/enter', async (req, res) => {
  await markUserAsHome(res.locals.user, 'geolocation');

  res.sendStatus(200);
});

export default router;