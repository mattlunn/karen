import express from 'express';
import config from '../config';
import * as requestTypes from '../services/alexa/requestTypes';
import asyncWrapper from '../helpers/express-async-wrapper';

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

export default router;