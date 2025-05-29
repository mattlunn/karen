import { Device, Event } from '../../models';
import ZWaveClient from './lib/client';
import logger from '../../logger';
import bus from '../../bus';
import config from '../../config';
import newrelic from 'newrelic';
import sleep from '../../helpers/sleep';

const deviceMap = new Map([
  ['Fibargroup FGMS001', 'motion_sensor'],
  ['Fibargroup FGD212', 'light'],
  ['Zooz ZSE44', 'humidity_sensor'],
  ['Yale SD-L1000-CH', 'lock']
]);

type DeviceHandler = {
  propertyKey: string,
  typeMapper: () => string,
  valueMapper: (value: any) => unknown
};

const deviceHandlers = new Map<string, DeviceHandler[]>();

deviceHandlers.set('Fibargroup FGMS001', [
  // Some of the sensors trigger the first event for motion, others trigger the 2nd.
  {
    propertyKey: 'Binary Sensor.Any',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'motion'
  },
  {
    propertyKey: 'Basic.currentValue',
    valueMapper: ({ newValue }) => newValue !== 0,
    typeMapper: () => 'motion'
  },
  { 
    propertyKey: 'Multilevel Sensor.Air temperature',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'temperature'
  },
  { 
    propertyKey: 'Multilevel Sensor.Illuminance',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'illuminance'
  },
  { 
    propertyKey: 'Battery.level',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'battery'
  }
]);

deviceHandlers.set('AEON Labs ZW100', [
  {
    propertyKey: 'Binary Sensor.Any',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'motion'
  },
  { 
    propertyKey: 'Multilevel Sensor.Air temperature',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'temperature'
  },
  { 
    propertyKey: 'Multilevel Sensor.Humidity',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'humidity'
  },
  { 
    propertyKey: 'Multilevel Sensor.Illuminance',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'illuminance'
  }
]);

deviceHandlers.set('Fibargroup FGD212', [
  { 
    propertyKey: 'Multilevel Sensor.Power',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'power'
  },
  { 
    propertyKey: 'Multilevel Switch.currentValue',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'brightness'
  },
  { 
    propertyKey: 'Multilevel Switch.currentValue',
    valueMapper: ({ newValue }) => newValue !== 0,
    typeMapper: () => 'on'
  }
]);

deviceHandlers.set('Zooz ZSE44', [
  {
    propertyKey: 'Multilevel Sensor.Humidity',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'humidity'
  },
  {
    propertyKey: 'Multilevel Sensor.Air temperature',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'temperature'
  },
  { 
    propertyKey: 'Battery.level',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'battery'
  }
]);

deviceHandlers.set('Yale SD-L1000-CH', [
  {
    propertyKey: 'Door Lock.boltStatus',
    valueMapper: ({ newValue }) => newValue === 'locked',
    typeMapper: () => 'locked'
  },
  {
    propertyKey: 'Notification.Access Control',
    valueMapper: ({ newValue }) => newValue === 11,
    typeMapper: () => 'is_jammed'
  },
  {
    propertyKey: 'Battery.isLow',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'battery_low'
  },
  {
    propertyKey: 'Battery.level',
    valueMapper: ({ newValue }) => newValue,
    typeMapper: () => 'battery_percentage'
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

  while (true) {
    logger.info('Starting ZWave client...');

    try {
      await new Promise((_, rej) => {
        const client = new ZWaveClient(config.zwave);
        
        client.on('disconnected', (e: Error) => {
          rej(e);
        });

        client.on('event', async (data: any) => {
          if (data.source === 'node' && data.event === 'value updated') {
            const deviceId = data.nodeId;
            const device = await Device.findByProviderIdOrError('zwave', deviceId);
            const node = Array.from(client.getNodes()).find((x: any) => x.nodeId === deviceId) as any;
            const nodeType = `${node.deviceConfig.manufacturer} ${node.deviceConfig.label}`;
            const eventHandlers = deviceHandlers.get(nodeType)!.filter(x => x.propertyKey === `${data.args.commandClassName}.${data.args.property}`);

            for (const { typeMapper, valueMapper } of eventHandlers) {
              const eventType = typeMapper();
              const eventValue = valueMapper(data.args);
              const lastEvent = await device.getLatestEvent(eventType);
              const now = new Date();

              if (eventValue === true) {
                if (lastEvent && lastEvent.end === null) {
                  continue;
                }

                await Event.create({
                  deviceId: device.id,
                  type: eventType,
                  value: 1,
                  start: now
                });
              } else if (eventValue === false) {
                if (lastEvent === null || lastEvent.end) {
                  continue;
                }

                lastEvent.end = now;
                await lastEvent.save();
              } else if (!lastEvent || lastEvent.value !== eventValue) {
                if (lastEvent) {
                  lastEvent.end = now;
                  await lastEvent.save();
                }

                await Event.create({
                  deviceId: device.id,
                  type: eventType,
                  value: eventValue as number,
                  start: now
                });
              }

              device.onPropertyChanged(eventType);
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
  getMotionSensorCapability(device) {
    return {
      async getHasMotion() {
        const latestEvent = await device.getLatestEvent('motion');

        return !!(latestEvent && !latestEvent.end);
      }
    };
  },

  getLightCapability(device) {
    return {
      async getBrightness() {
        return (await device.getLatestEvent('brightness'))?.value ?? 0;
      },

      async setBrightness(brightness) {
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
      },

      async getIsOn() {
        const latestEvent = await device.getLatestEvent('on');

        return !!(latestEvent && !latestEvent.end);
      },

      async setIsOn(isOn) {
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
    }
  },

  getTemperatureSensorCapability(device) {
    return {
      async getCurrentTemperature(): Promise<number> {
        return (await device.getLatestEvent('temperature'))?.value ?? 0;
      }
    };
  },

  getHumiditySensorCapability(device) {
    return {
      async getHumidity(): Promise<number> {
        return (await device.getLatestEvent('humidity'))?.value ?? 0;
      }
    };
  },

  getLightSensorCapability(device) {
    return {
      async getIlluminance(): Promise<number> {
        return (await device.getLatestEvent('illuminance'))?.value ?? 0;
      }
    };
  },

  getBatteryLevelIndicatorCapability(device) {
    return {
      async getBatteryPercentage(): Promise<number> {
        return (await device.getLatestEvent('battery_percentage'))?.value ?? 0;
      }
    };
  },

  getBatteryLowIndicatorCapability(device) {
    return {
      async getIsBatteryLow(): Promise<boolean> {
        return ((await device.getLatestEvent('battery_low'))?.value ?? 0) === 1;
      }
    };
  },

  getLockCapability(device) {
    return {
      async getIsLocked(): Promise<boolean> {
        const latestEvent = await device.getLatestEvent('locked');

        return !!(latestEvent && !latestEvent.end);
      },

      async getIsJammed(): Promise<boolean> {
        const latestEvent = await device.getLatestEvent('is_jammed');

        return !!(latestEvent && !latestEvent.end);
      },
      
      async ensureIsLocked(abortSignal: AbortSignal): Promise<void> {
        if (await this.getIsLocked()) {
          return;
        }

        if (await this.getIsJammed()) {
          throw new Error('Lock is jammed');
        }

        return new Promise((res, rej) => {
          function cleanup() {
            bus.off('EVENT_START', eventHandler);
          }
          
          async function eventHandler(event: Event) {
            if (event.deviceId === device.id) {
              if (event.type === 'locked') {
                cleanup();
                res();
              }

              if (event.type === 'is_jammed') {
                cleanup();
                rej(new Error('Lock is jammed'));
              }
            }
          }

          abortSignal.addEventListener('abort', () => {
            cleanup();
            rej(abortSignal.reason);
          });

          bus.on('EVENT_START', eventHandler);
          this.setIsLocked(true);
        });
      },

      async setIsLocked(isLocked: boolean) {
        const client = await getClient();

        return client.makeRequest('node.set_value', {
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
    switch (device.type) {
      case 'light':
        return ['LIGHT'];
      case 'lock':
          return ['LOCK', 'BATTERY_LEVEL_INDICATOR', 'BATTERY_LOW_INDICATOR'];
      case 'multi_sensor':
        return ['LIGHT_SENSOR', 'TEMPERATURE_SENSOR', 'MOTION_SENSOR'];
      case 'humidity_sensor':
          return ['TEMPERATURE_SENSOR', 'HUMIDITY_SENSOR'];
      default:
        throw new Error(`${device.type} is unrecognised`);
    }
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
        const deviceName = `${node.deviceConfig.manufacturer} ${node.deviceConfig.label}`;
        const deviceId = node.nodeId;
        const deviceType = deviceMap.get(deviceName);

        if (typeof deviceType === 'undefined') {
          logger.warn(`ZWave does not know how to handle a device of type "${deviceName}" (Device Id ${deviceId})`);
        } else {
          let knownDevice = await Device.findByProviderId('zwave', deviceId);
  
          if (!knownDevice) {
            knownDevice = await Device.create({
              type: deviceType,
              provider: 'zwave',
              providerId: deviceId,
              name: deviceName
            });
          }
        }
      }
    }
  }
});
