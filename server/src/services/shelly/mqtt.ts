import { connect, MqttClient } from 'mqtt';
import { Device } from '../../models';
import config from '../../config/app';
import logger from '../../logger';

const TOPIC_PREFIX = 'shellies';

// Fixed "src" identifying this app instance to devices for RPC request/response
// correlation - Shelly Gen2+ devices publish their reply to `${src}/rpc`.
const RPC_SRC = 'karen';
const RPC_TIMEOUT_MS = 10000;

type PendingRpcRequest = {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
};

const pendingRpcRequests = new Map<number, PendingRpcRequest>();
let nextRpcRequestId = 1;

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
        `${TOPIC_PREFIX}/+/status/+`,
        `${RPC_SRC}/rpc`,
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
      if (topic === `${RPC_SRC}/rpc`) {
        handleRpcResponse(payload.toString());
        return;
      }

      handleMessage(topic, payload.toString()).catch((err) => {
        logger.error(err, `Shelly MQTT failed to handle ${topic}`);
      });
    });
  }

  return client;
}

function handleRpcResponse(payload: string): void {
  const message = JSON.parse(payload);
  const pending = pendingRpcRequests.get(message.id);

  if (!pending) {
    return;
  }

  pendingRpcRequests.delete(message.id);

  if (message.error) {
    pending.reject(new Error(message.error.message ?? JSON.stringify(message.error)));
  } else {
    pending.resolve(message.result);
  }
}

async function handleMessage(topic: string, payload: string): Promise<void> {
  const segments = topic.split('/');
  const mqttId = segments[1];
  const subtopic = segments.slice(2).join('/');

  const device = await Device.findByProviderId('shelly', mqttId);

  if (device === null) {
    return;
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

  // BLU (Bluetooth) sensors are relayed under their pairing gateway's own topic,
  // keyed by a small integer the gateway assigns locally when the sensor is
  // bound (see BTHome.AddDevice) rather than by the sensor's own MAC. That id
  // isn't unique across Shelly devices — only within one gateway — so it can't
  // be the child's providerId; and the gateway's own providerId is already
  // taken by the gateway device itself. So each BLU child stores its pairing
  // in meta (`gatewayProviderId` + `sensors: { [sensorId]: property }`) and we
  // look it up by that pair.
  // The Presence Gen4 publishes one status topic per configured zone. Each zone
  // is an instance of this device's MOTION_SENSOR capability (zones are regions
  // of one sensor's field of view, not separate hardware), so the zone id from
  // the topic addresses the instance directly.
  if (subtopic.startsWith('status/presencezone:')) {
    const zoneId = `zone${subtopic.slice('status/presencezone:'.length)}`;
    const data = JSON.parse(payload);

    if (capabilities.includes('MOTION_SENSOR')) {
      await device.getMotionSensorCapability(zoneId).setHasMotionState(data.value);
    }

    return;
  }

  if (subtopic.startsWith('status/bthomesensor:')) {
    const sensorId = subtopic.slice('status/bthomesensor:'.length);
    const data = JSON.parse(payload);
    const children = await Device.findByProvider('shelly');
    const child = children.find((d) => d.meta.gatewayProviderId === mqttId && (d.meta.sensors as Record<string, string> | undefined)?.[sensorId]);

    if (child) {
      const property = (child.meta.sensors as Record<string, string>)[sensorId];

      if (property === 'contact') {
        await child.getContactSensorCapability().setIsOpenState(Boolean(data.value));
      } else if (property === 'battery') {
        await child.getBatteryLevelIndicatorCapability().setBatteryPercentageState(data.value);
      }
    }

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

// Gen2+ JSON-RPC request/response over MQTT: publish a request to the device's
// `/rpc` topic and wait for its reply on our own `${RPC_SRC}/rpc` topic,
// correlated by request id.
export function sendRpcRequest(deviceId: string, method: string, params?: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = nextRpcRequestId++;

    const timeout = setTimeout(() => {
      if (pendingRpcRequests.delete(id)) {
        reject(new Error(`Timed out waiting for a response to ${method} on ${deviceId}`));
      }
    }, RPC_TIMEOUT_MS);

    pendingRpcRequests.set(id, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });

    getClient().publish(`${TOPIC_PREFIX}/${deviceId}/rpc`, JSON.stringify({ id, src: RPC_SRC, method, params }), { qos: 1 }, (err) => {
      if (err) {
        pendingRpcRequests.delete(id);
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

getClient();
