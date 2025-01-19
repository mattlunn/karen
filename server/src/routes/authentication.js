import { Token, User } from '../models';
import auth from '../middleware/auth';
import { Router } from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import moment from 'moment';
import config from '../config';
import logger from '../logger';

const router = Router();

router.post('/login', asyncWrapper(async (req, res) => {
  const user = await User.findByCredentials(req.body.username, req.body.password);

  if (user) {
    const expiry = moment().add(1, 'y').toDate();
    const token = await Token.createForUser(user);

    res
      .cookie('OAuth.AccessToken', token, {
        expires: expiry,
        httpOnly: false,
        sameSite: true
      })
      .send({
        username: user.handle,
        token
      })
      .end();
  } else {
    res
      .status(404)
      .end();
  }
}));

router.post('/logout', auth, asyncWrapper(async (req, res) => {
  if (await Token.expire(req.token)) {
    res.redirect('/');
  } else {
    res.sendStatus(500);
  }
}));

router.get('/authorize', asyncWrapper(async (req, res) => {
  logger.info(config.authentication);

  const client = config.authentication.clients.find(x => x.client_id === req.query.client_id);

  if (!client) {
    res.sendStatus(400);
  } else {
    res.redirect(`${req.query.redirect_uri}?state=${req.query.state}&code=${Date.now()}`);
  }
}));

router.post('/token', asyncWrapper(async (req, res) => {
  const client = config.authentication.clients.find(x => x.client_id === req.body.client_id && x.client_secret === req.body.client_secret);

  if (!client) {
    return res.sendStatus(400);
  }

  res.json({
    access_token: client.access_token,
    token_type: 'bearer',
    expires_in: moment.duration(1, 'y').asSeconds(),
    refresh_token: 'invalid'
  });
}));

export default router;