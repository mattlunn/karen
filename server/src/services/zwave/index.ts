import { Device, Event } from '../../models';
import getClient from './lib/client';
import logger from '../../logger';
import bus from '../../bus';

const deviceMap = new Map([
  ['Fibargroup FGMS001', 'motion_sensor'],
  ['Fibargroup FGD212', 'light'],
  ['Zooz ZSE44', 'humidity_sensor'],
  ['Yale SD-L1000-CH', 'lock']
]);

type DeviceHandler = (device: Device, newValue: any) => Promise<void>;

const capabilityHandlers = new Map<string, DeviceHandler>();

capabilityHandlers.set(
  'Binary Sensor.Any',
  (device, { newValue }) => device.getMotionSensorCapability().setHasMotionState(newValue)
);

capabilityHandlers.set(
  'Basic.currentValue',
  (device, { newValue }) => device.getMotionSensorCapability().setHasMotionState(newValue !== 0)
);

capabilityHandlers.set(
  'Multilevel Sensor.Air temperature',
  (device, { newValue }) => device.getTemperatureSensorCapability().setTemperatureState(newValue)
);

capabilityHandlers.set(
  'Multilevel Sensor.Illuminance',
  (device, { newValue }) => device.getLightSensorCapability().setIlluminanceState(newValue)
);

capabilityHandlers.set(
  'Multilevel Sensor.Humidity',
  (device, { newValue }) => device.getHumiditySensorCapability().setHumidityState(newValue)
);

capabilityHandlers.set(
  'Multilevel Switch.currentValue',
  (device, { newValue }) => device.getLightCapability().setBrightnessState(newValue)
);

capabilityHandlers.set(
  'Multilevel Switch.currentValue',
  (device, { newValue }) => device.getLightCapability().setIsOnState(newValue)
);

capabilityHandlers.set(
  'Battery.level',
  (device, { newValue }) => device.getBatteryLevelIndicatorCapability().setBatteryLevelState(newValue)
);

capabilityHandlers.set(
  'Battery.level',
  (device, { newValue }) => device.getBatteryLowIndicatorCapability().setBatteryLowState(newValue)
);

capabilityHandlers.set(
  'Door Lock.boltStatus',
  (device, { newValue }) => device.getLockCapability().setIsLockedState(newValue === 'locked')
);

capabilityHandlers.set(
  'Notification.Access Control',
  (device, { newValue }) => device.getLockCapability().setIsJammedState(newValue === 11)
);

getClient().then(({ on, getNodes }) => {
  on('event', async (data: any) => {
    if (data.source === 'node' && data.event === 'value updated') {
      const device = await Device.findByProviderIdOrError('zwave', data.nodeId);
      const eventHandler = capabilityHandlers.get(`${data.args.commandClassName}.${data.args.property}`);

      if (eventHandler !== undefined) {
        await eventHandler(device, data.args);
      }
    }
  });
});

Device.registerProvider('zwave', {
  getLightCapability(device) {
    return {
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
      }
    };
  },

  getLockCapability(device) {
    return {
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
        const { makeRequest } = await getClient();

        return makeRequest('node.set_value', {
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
    const { getNodes } = await getClient();

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

    for (const node of getNodes()) {
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
