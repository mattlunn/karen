import express from 'express';
import config from '../config';
import * as requestTypes from '../services/alexa/requestTypes';
import { exchangeAuthenticationToken } from '../services/alexa/client';
import asyncWrapper from '../helpers/express-async-wrapper';
import auth from '../middleware/auth';

const router = express.Router();

router.post('/endpoint', asyncWrapper(async (req, res) => {
  if (req.body.context.System.application.applicationId !== config.alexa.id) {
    return res.status(401).end();
  }

  if (requestTypes.hasOwnProperty(req.body.request.type)) {
    const response = await requestTypes[req.body.request.type](req.body.request);

    res.status(200).json({ version: '1.0', response }).end();
  } else {
    res.status(404)
      .send('No handler setup to handle ' + req.body.request.type)
      .end();
  }
}));

router.post('/grant', auth, (req, res) => {
   // For reasons no-one understands, Amazon provide a JSON body, but with a 'text/plain' Accept type.
  exchangeAuthenticationToken('authorization_code', JSON.parse(req.body).code).then(() => {
    res.sendStatus(204);
  }, () => {
    res.sendStatus(500);
  });
});

export default router;