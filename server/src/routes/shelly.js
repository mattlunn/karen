import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import config from '../config';
import { Device, Event } from '../models';
import DeviceClient from '../services/shelly/client/device';

const router = express.Router();

router.use((req, res, next) => {
  if (req.query.secret !== config.shelly.secret) {
    return res.sendStatus(401).end();
  } else {
    next();
  }
});

router.get('/event', asyncWrapper(async (req, res) => {
  const device = await Device.findByProviderIdOrError('shelly', req.query.id);
  const lastEvent = await device.getLatestEvent('on');
  const time = new Date();
  const isOn = req.query.action === 'on';

  if (isOn) {
    if (lastEvent && !lastEvent.end) {
      console.error(`"${device.id}" has been turned on, but is already turned on...`);
    } else {
      await Event.create({
        deviceId: device.id,
        type: 'on',
        start: time,
        value: 1
      });
    }
  } else {
    if (!lastEvent || lastEvent.end) {
      console.error(`"${device.id}" has been turned off, but has no active event...`);
    } else {
      lastEvent.end = time;
      await lastEvent.save();
    }
  }

  device.onPropertyChanged('on');

  res.sendStatus(200).end();
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
  device.meta.endpoint = ip;
  
  await client.setCloudStatus(false);
  await client.setupAuthentication();
  await client.addAction('out_off_url', `http://${config.shelly.webhook_host}/shelly/event?secret=${config.shelly.secret}&id=${ip}&action=off`);
  await client.addAction('out_on_url', `http://${config.shelly.webhook_host}/shelly/event?secret=${config.shelly.secret}&id=${ip}&action=on`);
  await device.save();

  res.sendStatus(201).end();
}));

export default router;