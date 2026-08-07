import { connect, MqttClient } from 'mqtt';
import { Device } from '../../models';
import config from '../../config';
import logger from '../../logger';

const TOPIC_PREFIX = 'shellies';

let client: MqttClient | null = null;

function getClient(): MqttClient {
  if (client === null) {
    client = connect(`mqtt://${config.shelly.mqtt.url}`, {
      username: config.shelly.mqtt.user,
      password: config.shelly.mqtt.password,
      reconnectPeriod: 5000,
    });

    client.on('connect', () => {
      logger.info('Shelly MQTT connected');

      client!.subscribe([
        `${TOPIC_PREFIX}/+/online`,
        `${TOPIC_PREFIX}/+/light/0/status`,
        `${TOPIC_PREFIX}/+/light/0/power`,
        `${TOPIC_PREFIX}/+/status/switch:0`,
        `${TOPIC_PREFIX}/+/status/input:0`,
        `${TOPIC_PREFIX}/+/blu`,
      ], (err) => {
        if (err) {
          logger.error(err, 'Shelly MQTT subscribe failed');
        }
      });
    });

    client.on('error', (err) => {
      logger.error(err, 'Shelly MQTT error');
    });

    client.on('message', (topic, payload) => {
      handleMessage(topic, payload.toString()).catch((err) => {
        logger.error(err, `Shelly MQTT failed to handle ${topic}`);
      });
    });
  }

  return client;
}

async function handleMessage(topic: string, payload: string): Promise<void> {
  const segments = topic.split('/');
  const mqttId = segments[1];
  const subtopic = segments.slice(2).join('/');

  let device = await Device.findByProviderId('shelly', mqttId);

  if (device === null) {
    // BLU (Bluetooth) door/window sensors can't be onboarded via the HTTP
    // install route (they have no IP), so auto-provision them on first sighting.
    // The gateway script publishes to `shellies/<blu-mac>/blu`, which places the
    // MAC in the existing providerId slot. Any other unknown device is ignored.
    if (subtopic !== 'blu') {
      return;
    }

    device = Device.build({ provider: 'shelly', providerId: mqttId });
    device.name = mqttId;
    device.manufacturer = 'Shelly';
    device.model = 'SBDW-002C';
    await device.save();
  }

  const capabilities = device.getCapabilities();

  if (subtopic === 'online') {
    await device.getConnectivityCapability().setIsConnectedState(payload === 'true');
    return;
  }

  if (subtopic === 'light/0/status') {
    const data = JSON.parse(payload);

    if (capabilities.includes('LIGHT')) {
      await device.getLightCapability().setIsOnState(data.ison);
      await device.getLightCapability().setBrightnessState(data.brightness);
    }

    return;
  }

  if (subtopic === 'light/0/power') {
    if (capabilities.includes('ENERGY_MONITOR')) {
      await device.getEnergyMonitorCapability().setCurrentPowerState(Math.round(parseFloat(payload) * 10) / 10);
    }

    return;
  }

  if (subtopic === 'status/switch:0') {
    const data = JSON.parse(payload);

    if (capabilities.includes('SWITCH')) {
      await device.getSwitchCapability().setIsOnState(data.output);
    }

    if (capabilities.includes('ENERGY_MONITOR')) {
      await device.getEnergyMonitorCapability().setCurrentPowerState(Math.round(data.apower * 10) / 10);
    }

    return;
  }

  if (subtopic === 'status/input:0' && capabilities.includes('ALARM_SENSOR')) {
    const data = JSON.parse(payload);

    await device.getAlarmSensorCapability().setIsTriggeredState(data.state);

    return;
  }

  if (subtopic === 'blu' && capabilities.includes('CONTACT_SENSOR')) {
    const data = JSON.parse(payload);

    // PROVISIONAL: the exact payload shape is defined by the BLE-gateway script
    // and must be confirmed against a captured message. BTHome window/door
    // (object 0x2D) reports 1 = open, 0 = closed.
    await device.getContactSensorCapability().setIsOpenState(Boolean(data.window));

    return;
  }
}

export function publishCommand(topic: string, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getClient().publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

getClient();
