import { Device } from '../../models';
import config from '../../config';
import DeviceClient from './client/device';
import Gen2PlusDeviceClient from './client/gen2plus-device';

export async function installWifiDevice(ip: string): Promise<Device> {
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
      if (!(client instanceof Gen2PlusDeviceClient)) {
        throw new Error(`${model} is expected to be a Gen2+ device`);
      }

      await client.setLedMode('off');

      break;
    }
  }

  await client.reboot();
  await device.save();

  return device;
}

// Onboards a BLU (Bluetooth) sensor that's already been paired locally (not just cloud relay)
// to a gateway device, e.g. via the Shelly app's Bluetooth settings for that gateway. `ip` is
// the gateway's own IP; `mac` is the sensor's BLE MAC.
export async function installBluSensor(ip: string, mac: string, name: string): Promise<Device> {
  const client = await DeviceClient.for(ip, config.shelly.user, config.shelly.password);

  if (!(client instanceof Gen2PlusDeviceClient)) {
    throw new Error(`${ip} is expected to be a Gen2+ device to act as a BLE gateway`);
  }

  const gatewayProviderId = await client.getMqttId();
  const sensors = await client.getBTHomeSensorsFor(mac);

  if (Object.keys(sensors).length === 0) {
    throw new Error(`No known BTHome sensor objects found for ${mac} on ${ip}. Has it been paired locally to this gateway (not just cloud relay)?`);
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

  return device;
}

// Records the zone layout for a Presence sensor that's already been installed via
// installWifiDevice. Zones are regions of one sensor's field of view rather than separate
// hardware, so they're stored as instances of this device's MOTION_SENSOR capability rather
// than as child devices. Read straight off the device's own config rather than asking a human
// to know/type the zone ids and names set up in the Shelly app.
export async function installPresenceZones(ip: string): Promise<Device> {
  const client = await DeviceClient.for(ip, config.shelly.user, config.shelly.password);

  if (!(client instanceof Gen2PlusDeviceClient)) {
    throw new Error(`${ip} is expected to be a Gen2+ device`);
  }

  const mqttId = await client.getMqttId();
  const device = await Device.findByProviderId('shelly', mqttId);

  if (!device) {
    throw new Error(`No device found for ${mqttId}. Install it via the WiFi/MQTT flow first.`);
  }

  const zones = await client.getPresenceZones();

  if (zones.length === 0) {
    throw new Error(`No presence zones are configured on ${ip}. Set them up in the Shelly app first.`);
  }

  device.meta.zones = zones;

  await device.save();

  return device;
}
