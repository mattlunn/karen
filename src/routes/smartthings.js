import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import * as handlers from '../services/smartthings/handlers';

const router = express.Router();

router.post('/endpoint', asyncWrapper(async (req, res) => {
  const lifecycle = req.body.lifecycle.toLowerCase();

  console.dir(req.body, { depth: null });

  if (handlers.hasOwnProperty(lifecycle)) {
    res.json(await Promise.resolve(handlers[lifecycle](req.body)));
  } else {
    res.sendStatus(400);
  }
}));

export default router;