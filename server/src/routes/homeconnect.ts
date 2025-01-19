import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import config from '../config';
import { stringify} from 'querystring';
import logger from '../logger';

const router = express.Router();

router.use((req, res, next) => {
  if (req.query.secret !== config.homeconnect.secret) {
    return res.sendStatus(401).end();
  } else {
    next();
  }
});

router.get('/authorize', asyncWrapper(async (req, res) => {
  if (typeof req.query.code === 'string') {
    const request = await fetch(`https://api.home-connect.com/security/oauth/token`, {
      body: stringify({
        client_id: config.homeconnect.client_id,
        client_secret: config.homeconnect.client_secret,
        grant_type: 'authorization_code',
        code: req.query.code
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    });

    const token = await request.json();

    logger.info(token);
  } else {
    res.redirect(`https://api.home-connect.com/security/oauth/authorize?response_type=code&client_id=${config.homeconnect.client_id}`);
  }
}));

export default router;