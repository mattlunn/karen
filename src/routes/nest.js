import express from 'express';
import request from 'request-promise-native';
import asyncWrapper from "../helpers/express-async-wrapper";
import uuid from 'uuid/v4';
import config from '../config';

const router = express.Router();

router.get('/auth', (req, res) => {
  res.redirect(`https://home.nest.com/login/oauth2?client_id=${config.nest.client_id}&state=${uuid()}`);
});

router.get('/auth/callback', asyncWrapper(async (req, res) => {
  let response;

  try {
    response = await request.post('https://api.home.nest.com/oauth2/access_token', {
      form: {
        client_id: config.nest.client_id,
        client_secret: config.nest.client_secret,
        code: req.query.code,
        grant_type: 'authorization_code'
      },
      json: true
    });
  } catch (e) {
    res.status(500)
      .json(e)
      .end();

    return;
  }

  res.status(200)
    .json(response)
    .end();
}));

export default router;