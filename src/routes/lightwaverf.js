import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import config from '../config';
import { client } from '../services/lightwaverf';
import { Device, Event } from '../models';

const router = express.Router();

/*
{ id: 'karen',
  userId: '15aa5b0a-69d5-4419-9ed9-e8b14291ba34',
  triggerEvent:
   { type: 'feature',
     id: '5a477b7772bed00a33c7198e-31-3157329939+0' },
  events:
   [ { type: 'feature',
       id: '5a477b7772bed00a33c7198e-19-3157329939+0' },
     { type: 'feature',
       id: '5a477b7772bed00a33c7198e-31-3157329939+0' },
     { type: 'feature',
       id: '5a477b7772bed00a33c7198e-43-3157329939+0' },
     { type: 'feature',
       id: '5a477b7772bed00a33c7198e-49-3157329939+0' },
     { type: 'feature',
       id: '5a477b7772bed00a33c7198e-61-3157329939+0' } ],
  payload: { time: 1559479315874, value: 1 } }
*/

router.post('/event', asyncWrapper(async (req, res) => {
  if (req.body.id !== config.lightwaverf.event_id) {
    res.sendStatus(400);
  }

  const lights = await Device.findByProvider('lightwaverf');
  const light = lights.find(x => x.meta.switchFeatureId === req.body.triggerEvent.id);
  const lastEvent = await light.getLatestEvent('on');
  const isOn = req.body.payload.value === 1;

  if (isOn) {
    if (lastEvent && !lastEvent.end) {
      console.error(`"${light.id}" has been turned on, but is already turned on...`);
    } else {
      await Event.create({
        deviceId: light.id,
        type: 'on',
        start: new Date(req.body.payload.time),
        value: 1
      });

      light.onPropertyChanged('on');
    }
  } else {
    if (!lastEvent || lastEvent.end) {
      console.error(`"${light.id}" has been turned off, but has no active event...`);
    } else {
      lastEvent.end = new Date(req.body.payload.time);
      await lastEvent.save();

      light.onPropertyChanged('on');
    }
  }

  res.sendStatus(200);
}));

router.get('/setup', asyncWrapper(async (req, res) => {
  const eventId = config.lightwaverf.event_id;
  const {
    secret,
    url
  } = req.query;

  if (secret !== config.lightwaverf.secret) {
    return res.sendStatus(401);
  }

  if (typeof url === 'undefined') {
    return res.status(400).json({
      error: 'Missing url parameter'
    });
  }

  const lights = await Device.findByProvider('lightwaverf');

  // Will error if first time setup, and karen hasn't been created yet.
  try {
    await client.request(`/events/${eventId}`, null, 'DELETE');
  } catch (e) {
    // Intentionally empty
  }

  await client.request('/events', {
    url: `${url}/lightwaverf/event`,
    ref: eventId,
    events: lights.map(({ meta: { switchFeatureId: id }}) => ({
      type: 'feature',
      id
    }))
  });

  res.sendStatus(200);
}));

export default router;