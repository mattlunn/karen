import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import config from '../config';
import { Device } from '../models';
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

  await device.getLightCapability().setIsOnState(req.query.action === 'on');
  res.sendStatus(200).end();
}));

router.get('/install', asyncWrapper(async (req, res) => {
  const ip = req.query.ip;

  if (!ip) {
    return res.end('Pass IP in query string');
  }

  const client = await DeviceClient.for(ip, config.shelly.user, config.shelly.password);
  const model = await client.getModel();
  let device = await Device.findByProviderId('shelly', ip);

  if (!device) {
    device = Device.build({
      provider: 'shelly',
      providerId: ip,
    });
  }

  device.name = ip;
  device.meta.endpoint = ip;
  device.meta.generation = client.getGeneration();
  
  await client.setCloudStatus(false);
  await client.setupAuthentication();
  await client.setOutputOffWebhook(`http://${config.shelly.webhook_host}/shelly/event?secret=${config.shelly.secret}&id=${ip}&action=off`);
  await client.setOutputOnWebhook(`http://${config.shelly.webhook_host}/shelly/event?secret=${config.shelly.secret}&id=${ip}&action=on`);

  switch (model) {
    case 'SNPL-00112UK': {  // plug
      await client.setLedMode('off');

      break;
    }
  }
  
  await client.reboot();
  await device.save();

  res.sendStatus(201).end();
}));

export default router;