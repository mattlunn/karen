import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import config from '../config';
import { client } from '../services/lightwaverf';
import { Device, Event } from '../models';
import uuid from 'uuid/v4';
import { saveConfig } from '../helpers/config';

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

const eventHandlers = new Map();

eventHandlers.set('dimLevel', async ({ featureId, value, time }) => {
  const lights = await Device.findByProvider('lightwaverf');
  const light = lights.find(x => x.meta.dimLevelFeatureId === featureId);
  const lastEvent = await light.getLatestEvent('brightness');

  if (lastEvent) {
    if (lastEvent.value === value) {
      return;
    } else {
      lastEvent.end = new Date(time);
      await lastEvent.save();
    }
  }

  await Event.create({
    deviceId: light.id,
    type: 'brightness',
    start: new Date(time),
    value
  });

  light.onPropertyChanged('brightness');
});

eventHandlers.set('switch', async ({ featureId, value, time }) => {
  const lights = await Device.findByProvider('lightwaverf');
  const light = lights.find(x => x.meta.switchFeatureId === featureId);
  const lastEvent = await light.getLatestEvent('on');
  const isOn = value === 1;

  if (isOn) {
    if (lastEvent && !lastEvent.end) {
      console.error(`"${light.id}" has been turned on, but is already turned on...`);
    } else {
      await Event.create({
        deviceId: light.id,
        type: 'on',
        start: new Date(time),
        value: 1
      });

      light.onPropertyChanged('on');
    }
  } else {
    if (!lastEvent || lastEvent.end) {
      console.error(`"${light.id}" has been turned off, but has no active event...`);
    } else {
      lastEvent.end = new Date(time);
      await lastEvent.save();

      light.onPropertyChanged('on');
    }
  }
});

router.post('/event', asyncWrapper(async (req, res) => {
  if (req.body.id !== config.lightwaverf.event_id) {
    res.sendStatus(400);
  }

  const payload = req.body.payload;

  if (eventHandlers.has(payload.type)) {
    await Promise.resolve(eventHandlers.get(payload.type)(payload));
  } else {
    console.error(`Lightwave's webhook does not know how to handle "${payload.type}" events`);
  }

  res.sendStatus(200);
}));

router.get('/setup', asyncWrapper(async (req, res) => {
  const secret = req.query.secret;

  if (secret !== config.lightwaverf.secret) {
    return res.sendStatus(401);
  }

  const lights = await Device.findByProvider('lightwaverf');
  const eventId = config.lightwaverf.event_id || uuid();

  // Will error if first time setup, and karen hasn't been created yet.
  try {
    await client.request(`/events/${eventId}`, null, 'DELETE');
  } catch (e) {
    // Intentionally empty
  }

  await client.request('/events', {
    url: `${req.protocol}://${req.hostname}/lightwaverf/event`,
    ref: eventId,
    events: lights.flatMap(({ meta: { switchFeatureId, dimLevelFeatureId }}) => ([{
      type: 'feature',
      id: dimLevelFeatureId
    }, {
      type: 'feature',
      id: switchFeatureId
    }]))
  });

  config.lightwaverf.event_id = eventId;
  config.lightwaverf.structure = (await client.structures()).structures[0];
  saveConfig();

  res.sendStatus(200);
}));

export default router;