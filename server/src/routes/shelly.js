import express from 'express';
import config from '../config';
import { Device } from '../models';
import DeviceClient from '../services/shelly/client/device';

const router = express.Router();

router.get('/install', async (req, res) => {
  const ip = req.query.ip;

  if (!ip) {
    return res.end('Pass IP in query string');
  }

  const client = await DeviceClient.for(ip, config.shelly.user, config.shelly.password);
  const model = await client.getModel();
  const mqttId = await client.getMqttId();

  let device = await Device.findByProviderId('shelly', mqttId);

  if (!device) {
    device = Device.build({ provider: 'shelly', providerId: mqttId });
  }

  device.name = ip;
  device.manufacturer = 'Shelly';
  device.model = model;

  delete device.meta.endpoint;

  await client.setCloudStatus(false);
  await client.setupAuthentication();

  await client.enableMqtt({
    id: mqttId,
    url: config.shelly.mqtt.url,
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

// Onboards a BLU (Bluetooth) sensor that's already been paired locally (not just
// cloud relay) to a gateway device, e.g. via the Shelly app's Bluetooth settings
// for that gateway. `ip` is the gateway's own IP; `addr` is the sensor's BLE MAC.
router.get('/install-blu', async (req, res) => {
  const { ip, addr, name } = req.query;

  if (!ip || !addr || !name) {
    return res.end('Pass ip (gateway), addr (sensor BLE MAC), and name in query string');
  }

  const client = await DeviceClient.for(ip, config.shelly.user, config.shelly.password);
  const gatewayProviderId = await client.getMqttId();
  const sensors = await client.getBTHomeSensorsFor(addr);

  if (Object.keys(sensors).length === 0) {
    return res.status(404).end(`No known BTHome sensor objects found for ${addr} on ${ip}. Has it been paired locally to this gateway (not just cloud relay)?`);
  }

  let device = await Device.findByProviderId('shelly', addr);

  if (!device) {
    device = Device.build({ provider: 'shelly', providerId: addr });
  }

  device.name = name;
  device.manufacturer = 'Shelly';
  device.model = 'SBDW-002C';
  device.meta.gatewayProviderId = gatewayProviderId;
  device.meta.sensors = sensors;

  await device.save();

  res.sendStatus(201).end();
});

export default router;
