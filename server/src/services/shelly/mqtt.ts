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
  const device = await Device.findByProviderId('shelly', mqttId);

  if (device === null) {
    return;
  }

  const subtopic = segments.slice(2).join('/');
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
      await device.getEnergyMonitorCapability().setCurrentPowerState(parseFloat(payload));
    }

    return;
  }

  if (subtopic === 'status/switch:0') {
    const data = JSON.parse(payload);

    if (capabilities.includes('SWITCH')) {
      await device.getSwitchCapability().setIsOnState(data.output);
    }

    return;
  }

  if (subtopic === 'status/input:0' && capabilities.includes('CONTACT_SENSOR')) {
    const data = JSON.parse(payload);

    await device.getContactSensorCapability().setIsClosedState(data.state);

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
