import express from 'express';
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

router.get('/event', async (req, res) => {
  const device = await Device.findByProviderIdOrError('shelly', req.query.id);
  const action = req.query.action;
  const capabilities = device.getCapabilities();

  if (capabilities.includes('CONTACT_SENSOR')) {
    await device.getContactSensorCapability().setIsClosedState(action === 'closed');
  } else if (capabilities.includes('LIGHT')) {
    await device.getLightCapability().setIsOnState(action === 'on');
  } else if (capabilities.includes('SWITCH')) {
    await device.getSwitchCapability().setIsOnState(action === 'on');
  }

  res.sendStatus(200).end();
});

router.get('/install', async (req, res) => {
  const ip = req.query.ip;

  if (!ip) {
    return res.end('Pass IP in query string');
  }

  const client = await DeviceClient.for(ip, config.shelly.user, config.shelly.password);
  const model = await client.getModel();
  const generation = client.getGeneration();
  let device = await Device.findByProviderId('shelly', ip);

  if (!device) {
    device = Device.build({
      provider: 'shelly',
      providerId: ip,
    });
  }

  let role = 'switch';

  if (generation >= 2) {
    try {
      const switchConfig = await client.getSwitchConfig();

      if (switchConfig && switchConfig.in_mode === 'detached') {
        role = 'contact';
      }
    } catch (e) {
      // Some Gen 2+ models may not expose Switch.GetConfig (e.g. dimmers); fall back to switch.
    }
  }

  device.name = ip;
  device.manufacturer = 'Shelly';
  device.model = model;
  device.meta.endpoint = ip;
  device.meta.generation = generation;
  device.meta.role = role;

  await client.setCloudStatus(false);
  await client.setupAuthentication();

  const eventUrl = (action) => `http://${config.shelly.webhook_host}/shelly/event?secret=${config.shelly.secret}&id=${ip}&action=${action}`;

  if (role === 'contact') {
    await client.setInputOnWebhook(eventUrl('closed'));
    await client.setInputOffWebhook(eventUrl('open'));
  } else {
    await client.setOutputOffWebhook(eventUrl('off'));
    await client.setOutputOnWebhook(eventUrl('on'));
  }

  switch (model) {
    case 'SNPL-00112UK': {  // plug
      await client.setLedMode('off');

      break;
    }
  }

  await client.reboot();
  await device.save();

  res.sendStatus(201).end();
});

export default router;