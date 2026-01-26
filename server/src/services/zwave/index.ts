import { Device } from '../../models';
import ZWaveClient from './lib/client';
import logger from '../../logger';
import config from '../../config';
import newrelic from 'newrelic';
import sleep from '../../helpers/sleep';

const deviceMap = new Map([
  ['Fibargroup FGMS001', 'multi_sensor'],
  ['Fibargroup FGD212', 'light'],
  ['Zooz ZSE44', 'humidity_sensor'],
  ['Yale SD-L1000-CH', 'lock']
]);

type DeviceHandler = {
  propertyKey: string,
  propertyMapper(device: Device, value: boolean | number | string): Promise<unknown>,
};

const deviceHandlers = new Map<string, DeviceHandler[]>();

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
    propertyMapper(device: Device, value: number) {
      return device.getMotionSensorCapability().setHasMotionState(value !== 0);
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
      return device.getLockCapability().setIsJammedState(value === 11);
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
            const eventHandler = deviceHandlers.get(nodeType)!.find(x => x.propertyKey === `${data.args.commandClassName}.${data.args.property}`);

            if (eventHandler) {
              eventHandler.propertyMapper(device, data.args.newValue);
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
    }
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
              name: node.name || `${deviceName} (${deviceId})`
            });
          }

          // TODO: Eventually move this to "on create" (right now we also have to correct existing devices)
          if (knownDevice.getCapabilities().includes('LIGHT')) {
            const brightnessHistory = await knownDevice.getLightCapability().getBrightnessHistory({ until: new Date(), limit : 1 });
    
            if (brightnessHistory.length === 0) {
              await knownDevice.getLightCapability().setBrightnessState(100, knownDevice.createdAt);
    
              logger.info(`Initialized brightness for zwave light device ${knownDevice.id}`);
            }
          }
        }
      }
    }
  }
});
