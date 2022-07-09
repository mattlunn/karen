import { Device, Event } from '../../models';
import getClient from './lib/client';

const deviceMap = new Map([
  ['Fibargroup FGMS001', 'motion_sensor'],
  ['Fibargroup FGD212', 'light']
]);

const deviceHandlers = new Map();

deviceHandlers.set('Fibargroup FGMS001', [
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

getClient().then(({ on, getNodes }) => {
  on('event', async (data) => {
    if (data.source === 'node' && data.event === 'value updated') {
      const deviceId = data.nodeId;
      const device = await Device.findByProviderId('zwave', deviceId);
      const node = Array.from(getNodes()).find(x => x.nodeId === deviceId);
      const nodeType = `${node.deviceConfig.manufacturer} ${node.deviceConfig.label}`;
      const eventHandlers = deviceHandlers.get(nodeType).filter(x => x.propertyKey === `${data.args.commandClassName}.${data.args.property}`);
    
      for (const { typeMapper, valueMapper } of eventHandlers) {
        const eventType = typeMapper(data.args);
        const eventValue = valueMapper(data.args);
        const lastEvent = await device.getLatestEvent(eventType);
        const now = Date.now();

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
          if (lastEvent && lastEvent.end !== null) {
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
            value: eventValue,
            start: now
          });
        }

        device.onPropertyChanged(eventType);
      }
    }
  });
});

Device.registerProvider('zwave', {
  async setProperty(device, key, value) {
    const { makeRequest } = await getClient();

    switch (key) {
      case 'on': {
        await makeRequest('node.set_value', {
          nodeId: Number(device.providerId),
          valueId: {
            commandClass: 38,
            endpoint: 1,
            property: "targetValue",
          },
          value: value ? 99 : 0
        });

        break;
      }

      case 'brightness': {
        await makeRequest('node.set_value', {
          nodeId: Number(device.providerId),
          valueId: {
            commandClass: 38,
            endpoint: 1,
            property: "targetValue",
          },
          value
        });

        break;
      }
      default:
        throw new Error(`"${key}" is not a recognised property for ZWave`);
    }
  },

  async getProperty(device, key) {
    switch (key) {
      case 'connected':
        return true;
      case 'motion':
      case 'on':
      case 'open': {
        const latestEvent = await device.getLatestEvent(key);

        return !!(latestEvent && !latestEvent.end);
      }
      case 'humidity':
      case 'illuminance':
      case 'brightness': {
        return (await device.getLatestEvent(key)).value;
      }
      default:
        throw new Error(`"${key}" is not a recognised property for ZWave`);
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
          console.warn(`ZWave does not know how to handle a device of type "${deviceName}" (Device Id ${deviceId})`);
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
