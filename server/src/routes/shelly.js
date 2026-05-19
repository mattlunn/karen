import express from 'express';
import config from '../config';
import { Device } from '../models';
import DeviceClient from '../services/shelly/client/device';

const router = express.Router();

function hostPortFromUrl(url) {
  return url.replace(/^[a-z]+:\/\//, '');
}

router.get('/install', async (req, res) => {
  const ip = req.query.ip;

  if (!ip) {
    return res.end('Pass IP in query string');
  }

  const client = await DeviceClient.for(ip, config.shelly.user, config.shelly.password);
  const model = await client.getModel();
  const generation = client.getGeneration();
  const mqttId = await client.getMqttId();

  let device = await Device.findByProviderId('shelly', mqttId);

  if (!device) {
    device = await Device.findByProviderId('shelly', ip);
  }

  if (!device) {
    device = Device.build({
      provider: 'shelly',
      providerId: mqttId,
    });
  } else {
    device.providerId = mqttId;
  }

  let role = 'switch';

  if (generation === 4) {
    const switchConfig = await client.getSwitchConfig();

    if (switchConfig.in_mode === 'detached') {
      role = 'contact';
    }
  }

  device.name = ip;
  device.manufacturer = 'Shelly';
  device.model = model;
  device.meta.generation = generation;
  device.meta.role = role;
  delete device.meta.endpoint;

  await client.setCloudStatus(false);
  await client.setupAuthentication();

  await client.enableMqtt({
    url: hostPortFromUrl(config.shelly.mqtt.url),
    user: config.shelly.mqtt.user,
    password: config.shelly.mqtt.password,
  });

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
