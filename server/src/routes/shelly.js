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

router.get('/install-wifi', async (req, res) => {
  const { ip } = req.query;

  if (!ip) {
    return res.end('Pass ip in query string');
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
// for that gateway. `ip` is the gateway's own IP; `mac` is the sensor's BLE MAC.
router.get('/install-blu', async (req, res) => {
  const { ip, mac, name } = req.query;

  if (!ip || !mac || !name) {
    return res.end('Pass ip (gateway), mac (sensor BLE MAC), and name in query string');
  }

  const client = await DeviceClient.for(ip, config.shelly.user, config.shelly.password);
  const gatewayProviderId = await client.getMqttId();
  const sensors = await client.getBTHomeSensorsFor(mac);

  if (Object.keys(sensors).length === 0) {
    return res.status(404).end(`No known BTHome sensor objects found for ${mac} on ${ip}. Has it been paired locally to this gateway (not just cloud relay)?`);
  }

  let device = await Device.findByProviderId('shelly', mac);

  if (!device) {
    device = Device.build({ provider: 'shelly', providerId: mac });
  }

  device.name = name;
  device.manufacturer = 'Shelly';
  device.model = 'SBDW-002C';
  device.meta.gatewayProviderId = gatewayProviderId;
  device.meta.sensors = sensors;

  await device.save();

  res.sendStatus(201).end();
});

// Records the zone layout for a Presence sensor that's already been installed
// via /install-wifi. Zones are regions of one sensor's field of view rather
// than separate hardware, so they're stored as instances of this device's
// MOTION_SENSOR capability rather than as child devices.
//
// `zones` is a comma-separated list of `<zoneId>:<name>` pairs, e.g.
//   ?ip=192.168.1.50&zones=zone0:Sofa,zone1:Desk
router.get('/install-presence-zones', async (req, res) => {
  const { ip, zones } = req.query;

  if (!ip || !zones) {
    return res.end('Pass ip and zones (e.g. zone0:Sofa,zone1:Desk) in query string');
  }

  const client = await DeviceClient.for(ip, config.shelly.user, config.shelly.password);
  const mqttId = await client.getMqttId();
  const device = await Device.findByProviderId('shelly', mqttId);

  if (!device) {
    return res.status(404).end(`No device found for ${mqttId}. Run /install-wifi for ${ip} first.`);
  }

  const parsed = zones.split(',').map((zone) => {
    const [id, ...name] = zone.split(':');

    return { id: id.trim(), name: name.join(':').trim() };
  });

  if (parsed.some(({ id, name }) => !id || !name)) {
    return res.status(400).end('Each zone must be <zoneId>:<name>, e.g. zone0:Sofa');
  }

  device.meta.zones = parsed;

  await device.save();

  res.sendStatus(201).end();
});

export default router;
