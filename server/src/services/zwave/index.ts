import dayjs from '../../dayjs';
import { Device } from '../../models';
import { Capability } from '../../models/capabilities';
import ZWaveClient from './lib/client';
import logger from '../../logger';
import config from '../../config/app';
import newrelic from 'newrelic';
import sleep from '../../helpers/sleep';

// Z-Wave Fibaro FGMS001: lower value = more sensitive (range 8-255, default 15)
// App model: higher value = more sensitive (range 0-100)
function zwaveToSensitivity(zwaveValue: number): number {
  return Math.round((255 - zwaveValue) / (255 - 8) * 100);
}

function sensitivityToZwave(sensitivity: number): number {
  return Math.round(255 - sensitivity / 100 * (255 - 8));
}

const deviceCapabilitiesMap = new Map<string, Capability[]>([
  ['Fibargroup FGMS001', ['LIGHT_SENSOR', 'TEMPERATURE_SENSOR', 'MOTION_SENSOR', 'BATTERY_LEVEL_INDICATOR', 'CONNECTIVITY']],
  ['Fibargroup FGD212', ['LIGHT', 'ENERGY_MONITOR', 'CONNECTIVITY']],
  ['Zooz ZSE44', ['TEMPERATURE_SENSOR', 'HUMIDITY_SENSOR', 'BATTERY_LEVEL_INDICATOR', 'CONNECTIVITY']],
  ['Yale SD-L1000-CH', ['LOCK', 'BATTERY_LEVEL_INDICATOR', 'BATTERY_LOW_INDICATOR', 'CONNECTIVITY']],
  ['Fibargroup FGPB-101', ['BUTTON', 'BATTERY_LEVEL_INDICATOR', 'CONNECTIVITY']]
]);

// zwave-js NodeStatus: 0=Unknown, 1=Asleep, 2=Awake, 3=Dead, 4=Alive.
// Battery-powered devices spend most of their time asleep but are still reachable;
// only "Dead" means the controller has lost contact.
const ZWAVE_NODE_STATUS_DEAD = 3;

// zwave-js only marks a node "Dead" after actively trying to reach it and failing.
// Sleeping (battery) nodes are never actively probed, so a dead-battery node just
// stays "Asleep" forever and never becomes "Dead". node.statistics.lastSeen ("the
// last time a command was received from or successfully sent to the node") is a
// generic per-node check-in signal, independent of which capability last reported,
// so we fall back to it to catch nodes that have gone quiet without zwave-js itself
// noticing.
const CONNECTIVITY_STALE_AFTER_MS = dayjs.duration(24, 'hours').asMilliseconds();

type DeviceHandler<T extends boolean | number | string = boolean | number | string> = {
  propertyKey: string,
  propertyMapper(device: Device, value: T, prevValue?: T): Promise<unknown>,
};

const deviceHandlers = new Map<string, DeviceHandler<any>[]>();

deviceHandlers.set('Fibargroup FGMS001', [
  // Some of the sensors trigger the first event for motion, others trigger the 2nd.
  {
    propertyKey: 'Binary Sensor.Any',
    propertyMapper(device: Device, value: boolean) {
      return device.getMotionSensorCapability().setHasMotionState(value);
    }
  },
  {
    propertyKey: 'Basic.currentValue',
    async propertyMapper(device: Device, value: number, prevValue?: number) {
      if (value !== prevValue) {
        await device.getMotionSensorCapability().setHasMotionState(value !== 0);
      }
    }
  },
  {
    propertyKey: 'Multilevel Sensor.Air temperature',
    propertyMapper(device: Device, value: number) {
      return device.getTemperatureSensorCapability().setCurrentTemperatureState(value);
    }
  },
  {
    propertyKey: 'Multilevel Sensor.Illuminance',
    propertyMapper(device: Device, value: number) {
      return device.getLightSensorCapability().setIlluminanceState(value);
    }
  },
  {
    propertyKey: 'Battery.level',
    propertyMapper(device: Device, value: number) {
      return device.getBatteryLevelIndicatorCapability().setBatteryPercentageState(value);
    }
  },
  {
    propertyKey: 'Configuration.1',
    async propertyMapper(device: Device, value: number) {
      device.meta.pendingSensitivity = undefined;
      await device.save();

      return device.getMotionSensorCapability().setSensitivityState(zwaveToSensitivity(value));
    }
  }
]);

deviceHandlers.set('AEON Labs ZW100', [
  {
    propertyKey: 'Binary Sensor.Any',
    propertyMapper(device: Device, value: boolean) {
      return device.getMotionSensorCapability().setHasMotionState(value);
    }
  },
  {
    propertyKey: 'Multilevel Sensor.Air temperature',
    propertyMapper(device: Device, value: number) {
      return device.getTemperatureSensorCapability().setCurrentTemperatureState(value);
    }
  },
  {
    propertyKey: 'Multilevel Sensor.Humidity',
    propertyMapper(device: Device, value: number) {
      return device.getHumiditySensorCapability().setHumidityState(value);
    }
  },
  {
    propertyKey: 'Multilevel Sensor.Illuminance',
    propertyMapper(device: Device, value: number) {
      return device.getLightSensorCapability().setIlluminanceState(value);
    }
  }
]);

deviceHandlers.set('Fibargroup FGD212', [
  {
    propertyKey: 'Multilevel Switch.currentValue',
    propertyMapper(device: Device, value: number) {
      return Promise.all([
        device.getLightCapability().setBrightnessState(value),
        device.getLightCapability().setIsOnState(value !== 0)
      ]);
    }
  },
  {
    // The Fibaro Dimmer 2 reports live power (W) via Multilevel Sensor CC,
    // not via the Meter CC (which carries the cumulative kWh reading).
    propertyKey: 'Multilevel Sensor.Power',
    propertyMapper(device: Device, value: number) {
      return device.getEnergyMonitorCapability().setCurrentPowerState(value);
    }
  }
]);

deviceHandlers.set('Zooz ZSE44', [
  {
    propertyKey: 'Multilevel Sensor.Humidity',
    propertyMapper(device: Device, value: number) {
      return device.getHumiditySensorCapability().setHumidityState(value);
    }
  },
  {
    propertyKey: 'Multilevel Sensor.Air temperature',
    propertyMapper(device: Device, value: number) {
      return device.getTemperatureSensorCapability().setCurrentTemperatureState(value);
    }
  },
  {
    propertyKey: 'Battery.level',
    propertyMapper(device: Device, value: number) {
      return device.getBatteryLevelIndicatorCapability().setBatteryPercentageState(value);
    }
  }
]);

deviceHandlers.set('Fibargroup FGPB-101', [
  {
    propertyKey: 'Battery.level',
    propertyMapper(device: Device, value: number) {
      return device.getBatteryLevelIndicatorCapability().setBatteryPercentageState(value);
    }
  }
]);

deviceHandlers.set('Yale SD-L1000-CH', [
  {
    propertyKey: 'Door Lock.boltStatus',
    propertyMapper(device: Device, value: string) {
      return device.getLockCapability().setIsLockedState(value === 'locked');
    }
  },
  {
    propertyKey: 'Notification.Access Control',
    propertyMapper(device: Device, value: number) {
      // is_jammed is a momentary event, so only record an occurrence when the
      // lock reports a jam (value 11); other notifications are not "un-jams".
      if (value === 11) {
        return device.getLockCapability().setIsJammedState(true);
      }

      return Promise.resolve();
    }
  },
  {
    propertyKey: 'Battery.isLow',
    propertyMapper(device: Device, value: boolean) {
      return device.getBatteryLowIndicatorCapability().setIsBatteryLowState(value);
    }
  },
  {
    propertyKey: 'Battery.level',
    propertyMapper(device: Device, value: number) {
      return device.getBatteryLevelIndicatorCapability().setBatteryPercentageState(value);
    }
  }
]);

async function getClient() {
  const client = new ZWaveClient(config.zwave);
  await client.connect();

  return client;
}

(async function () {
  const BACKOFFS = [1, 5, 60];
  let backoffIndex = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    logger.info('Starting ZWave client...');

    try {
      await new Promise((_, rej) => {
        const client = new ZWaveClient(config.zwave);

        client.on('disconnected', (e: Error) => {
          rej(e);
        });

        client.on('event', async (data: any) => {
          if (data.source === 'node' && (data.event === 'alive' || data.event === 'dead')) {
            const device = await Device.findByProviderId('zwave', data.nodeId);

            if (device !== null) {
              await device.getConnectivityCapability().setIsConnectedState(data.event === 'alive');
            }
          }

          if (data.source === 'node' && data.event === 'value updated') {
            const deviceId = data.nodeId;
            const device = await Device.findByProviderIdOrError('zwave', deviceId);
            const node = Array.from(client.getNodes()).find((x: any) => x.nodeId === deviceId) as any;
            const nodeType = `${node.deviceConfig.manufacturer} ${node.deviceConfig.label}`;
            const handlers = deviceHandlers.get(nodeType);

            if (handlers === undefined) {
              logger.warn(`No Z-Wave deviceHandlers registered for node type "${nodeType}" (Device Id ${deviceId})`);
            } else {
              const eventHandler = handlers.find(x => x.propertyKey === `${data.args.commandClassName}.${data.args.property}`);

              if (eventHandler) {
                eventHandler.propertyMapper(device, data.args.newValue, data.args.prevValue);
              }
            }
          }

          if (data.source === 'node' && data.event === 'value notification') {
            // Central Scene key attribute values: 0=single press, 1=released, 2=held, 3+=multi-press
            if (data.args.commandClassName === 'Central Scene' && data.args.value !== 1) {
              const device = await Device.findByProviderIdOrError('zwave', data.nodeId);
              const pressedAt = new Date();

              await device.getButtonCapability().setPressedState(true, pressedAt);
            }
          }
        });

        client.connect().then(() => {
          logger.info('ZWave client connection established');
          backoffIndex = 0;
        }, rej);
      });
    } catch (e) {
      const timeout = BACKOFFS[Math.min(backoffIndex++, BACKOFFS.length - 1)];

      newrelic.noticeError(e as Error);
      logger.error(e, `Zwave client disconnected; waiting ${timeout} seconds before retrying...`);

      await sleep(timeout * 1000);
    }
  }
}());

Device.registerProvider('zwave', {
  provideLightCapability() {
    return {
      async setIsOn(device: Device, isOn: boolean) {
        const { makeRequest } = await getClient();

        await makeRequest('node.set_value', {
          nodeId: Number(device.providerId),
          valueId: {
            commandClass: 38,
            endpoint: 1,
            property: "targetValue",
          },
          value: isOn ? 99 : 0
        });
      },

      async setBrightness(device: Device, brightness: number) {
        const { makeRequest } = await getClient();

        await makeRequest('node.set_value', {
          nodeId: Number(device.providerId),
          valueId: {
            commandClass: 38,
            endpoint: 1,
            property: "targetValue",
          },
          value: Math.min(brightness, 99)
        });
      }
    };
  },

  provideMotionSensorCapability() {
    return {
      async setSensitivity(device: Device, sensitivity: number) {
        device.meta.pendingSensitivity = sensitivity;
        await device.save();

        const { makeRequest } = await getClient();

        // FGMS001 is battery-powered and sleeps between check-ins; if it's asleep,
        // this command is queued and it's unconfirmed how long the underlying
        // promise takes to settle. Don't let the caller (the API request) hang on
        // that - confirmation arrives later via the Configuration.1 propertyMapper
        // once zwave-js's cache actually reflects the change, whenever that is.
        const result = await Promise.race([
          makeRequest('node.set_value', {
            nodeId: Number(device.providerId),
            valueId: {
              commandClass: 112,
              endpoint: 0,
              property: 1,
            },
            value: sensitivityToZwave(sensitivity)
          }).then(() => 'sent' as const),
          sleep(5000).then(() => 'timeout' as const)
        ]);

        if (result === 'timeout') {
          logger.warn(`Timed out waiting for Z-Wave to confirm the sensitivity change was sent to device ${device.id}; it may still be queued for delivery`);
        }
      }
    };
  },

  provideLockCapability() {
    return {
      async setIsLocked(device: Device, isLocked: boolean): Promise<void> {
        const client = await getClient();

        await client.makeRequest('node.set_value', {
          nodeId: Number(device.providerId),
          valueId: {
            commandClass: 98,
            endpoint: 0,
            property: "targetMode",
          },
          value: isLocked ? 255 : 0
        });
      }
    };
  },

  getCapabilities(device) {
    const deviceKey = `${device.manufacturer} ${device.model}`;
    const capabilities = deviceCapabilitiesMap.get(deviceKey);

    if (!capabilities) {
      throw new Error(`Z-Wave device ${device.id} has unknown manufacturer/model: ${deviceKey}`);
    }

    return capabilities;
  },

  async synchronize() {
    const client = await getClient();

    /*
      {
        nodeId: 7,
        index: 0,
        status: 1,
        ready: true,
        isListening: false,
        isRouting: true,
        isSecure: false,
        manufacturerId: 271,
        productId: 4097,
        productType: 2048,
        firmwareVersion: '2.7',
        deviceConfig: {
          filename: '/cache/db/devices/0x010f/fgms001.json',
          isEmbedded: true,
          manufacturer: 'Fibargroup',
          manufacturerId: 271,
          label: 'FGMS001',
          description: 'Motion Sensor',
          devices: [Array],
          firmwareVersion: [Object],
          associations: {},
          paramInformation: [Object]
        },
        label: 'FGMS001',
        interviewAttempts: 1,
        endpoints: [ [Object] ],
        values: [ [Object], [Object], [Object], [Object]],
        isFrequentListening: false,
        maxDataRate: 40000,
        supportedDataRates: [ 40000 ],
        protocolVersion: 3,
        supportsBeaming: true,
        supportsSecurity: false,
        nodeType: 1,
        deviceClass: {
          basic: [Object],
          generic: [Object],
          specific: [Object],
          mandatorySupportedCCs: [Array],
          mandatoryControlledCCs: []
        },
        interviewStage: 'Complete',
        deviceDatabaseUrl: 'https://devices.zwave-js.io/?jumpTo=0x010f:0x0800:0x1001:2.7',
        statistics: {
          commandsTX: 66,
          commandsRX: 169,
          commandsDroppedRX: 0,
          commandsDroppedTX: 0,
          timeoutResponse: 0,
          rtt: 30.3
        },
        highestSecurityClass: -1,
        isControllerNode: false,
        keepAwake: false
      }
    */

    for (const node of client.getNodes()) {
      if (node.ready) {
        const manufacturer = node.deviceConfig.manufacturer;
        const model = node.deviceConfig.label;
        const deviceKey = `${manufacturer} ${model}`;
        const deviceId = node.nodeId;
        const deviceCapabilities = deviceCapabilitiesMap.get(deviceKey);

        if (typeof deviceCapabilities === 'undefined') {
          logger.warn(`ZWave does not know how to handle a device of type "${deviceKey}" (Device Id ${deviceId})`);
        } else {
          try {
            let knownDevice = await Device.findByProviderId('zwave', deviceId);

            if (!knownDevice) {
              knownDevice = await Device.create({
                provider: 'zwave',
                providerId: deviceId,
                name: node.name || `${deviceKey} (${deviceId})`
              });
            }

            knownDevice.manufacturer = manufacturer;
            knownDevice.model = model;

            await knownDevice.save();

            const isDead = node.status === ZWAVE_NODE_STATUS_DEAD;
            const lastSeen = node.statistics?.lastSeen ? new Date(node.statistics.lastSeen) : null;
            const isStale = lastSeen !== null && (Date.now() - lastSeen.getTime()) > CONNECTIVITY_STALE_AFTER_MS;

            await knownDevice.getConnectivityCapability().setIsConnectedState(!isDead && !isStale);

            if (knownDevice.getCapabilities().includes('MOTION_SENSOR')) {
              const sensitivityEvent = await knownDevice.getMotionSensorCapability().getSensitivityEvent();

              if (sensitivityEvent === null) {
                const sensitivityValue = node.values?.find((v: any) => v.commandClass === 112 && v.property === 1);

                if (typeof sensitivityValue?.value === 'number') {
                  await knownDevice.getMotionSensorCapability().setSensitivityState(
                    zwaveToSensitivity(sensitivityValue.value),
                    knownDevice.createdAt
                  );

                  logger.info(`Initialized sensitivity for zwave motion sensor device ${knownDevice.id}`);
                }
              }
            }
          } catch (e) {
            // Don't let a single misbehaving node (e.g. a stale DB row) abort
            // sync for every node that follows it in iteration order.
            newrelic.noticeError(e as Error);
            logger.error(e, `Failed to synchronize zwave device ${deviceId}`);
          }
        }
      }
    }
  }
});
