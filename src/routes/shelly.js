import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import config from '../config';
import { Device, Event } from '../models';
import DeviceClient from '../services/shelly/client/device';

const router = express.Router();

router.use((req, res, next) => {
  if (req.query.auth !== config.shelly.secret) {
    return res.sendStatus(401).end();
  } else {
    next();
  }
});

router.get('/event', asyncWrapper(async (req, res) => {
  const device = await Device.findByProviderId('shelly', req.query.id);

  if (!device) {
    res.sendStatus(400).end('ID not provided/ recognised');
  }
  switch (req.query.action) {
    case 'on': {

    }
    case 'off': {
    }
    default:
      res.sendStatus(400).end('action not provided/ supported');      
  }
  await Event.create({
    deviceId: light.id,
    type: 'on',
    start: new Date(time),
    value: 1
  });

  light.onPropertyChanged('on');
}));

router.get('/install', asyncWrapper(async (req, res) => {
  const ip = req.query.ip;

  if (!ip) {
    return res.end('Pass IP in query string');
  }

  const client = new DeviceClient(ip, config.shelly.user, config.shelly.password);
  let device = await Device.findByProviderId('shelly', ip);

  if (!device) {
    device = Device.build({
      provider: 'shelly',
      providerId: ip,
    });
  }

  device.name = ip;
  device.type = 'light';
  
  await client.setCloudStatus(false);
  await client.setupAuthentication();
  await client.addAction('out_off_url', `${req.protocol}://${req.hostname}/shelly/event?auth=${config.shelly.secret}&id=${ip}&action=off`);
  await client.addAction('out_on_url', `${req.protocol}://${req.hostname}/shelly/event?auth=${config.shelly.secret}&id=${ip}&action=on`);
  await device.save();

  res.sendStatus(201).end();
}));

export default router;