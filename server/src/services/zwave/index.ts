import { Device, Event } from '../../models';
import getClient from './lib/client';
import logger from '../../logger';

const deviceMap = new Map([
  ['Fibargroup FGMS001', 'motion_sensor'],
  ['Fibargroup FGD212', 'light'],
  ['Zooz ZSE44', 'humidity_sensor']
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

getClient().then(({ on, getNodes }) => {
  on('event', async (data: any) => {
    if (data.source === 'node' && data.event === 'value updated') {
      const deviceId = data.nodeId;
      const device = await Device.findByProviderIdOrError('zwave', deviceId);
      const node = Array.from(getNodes()).find((x: any) => x.nodeId === deviceId) as any;
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
});

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
      async getIlluminance() {
        return (await device.getLatestEvent('illuminance'))?.value ?? 0;
      }
    };
  },

  getCapabilities(device) {
    switch (device.type) {
      case 'light':
        return ['LIGHT'];
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
