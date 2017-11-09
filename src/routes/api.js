import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import { Stay } from '../models';
import { HOME, AWAY } from '../constants/status';
import { User, Token } from '../models';

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

router.get('/status', asyncWrapper(async (req, res) => {
  const [upcoming, currentOrLast] = await Promise.all([
    Stay.findUpcomingStay(),
    Stay.findCurrentOrLastStay()
  ]);

  if (upcoming || currentOrLast.departure) {
    res.json({
      status: AWAY,
      since: currentOrLast.departure,
      until: upcoming ? upcoming.eta : null
    });
  } else {
    res.json({
      status: HOME,
      since: currentOrLast.arrival
    });
  }

  res.end();
}));

export default router;