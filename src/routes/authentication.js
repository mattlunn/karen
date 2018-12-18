import { Token, User } from '../models';
import auth from '../middleware/auth';
import { Router } from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import moment from 'moment';

const router = Router();

router.post('/login', asyncWrapper(async (req, res) => {
  debugger;

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

export default router;