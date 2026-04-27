import config from '../../config';
import { Device } from '../../models';
import { DeviceCapabilityEvents } from '../../models/capabilities';
import { sendAddOrUpdateReport, sendSimpleEventSource } from './client';
import logger from '../../logger';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';

export const messages = new Map();

/**
 * Alexa does not allow unsolicited TTS, so we use Alexa.SimpleEventSource to trigger a Routine.
 *
 * Each Alexa speaker device is exposed as a SimpleEventSource endpoint. When say() is called:
 *  1. The message is stored in the messages Map
 *  2. A SimpleEventSource trigger is sent to Alexa via the Events API
 *  3. The user's Routine fires (triggered by the SimpleEventSource event)
 *  4. The Routine calls the WhatsTheMessage Intent, which retrieves and reads the message
 */

Device.registerProvider('alexa', {
  getCapabilities(device: Device) {
    return [
      'SPEAKER'
    ];
  },

  provideSpeakerCapability() {
    return {
      /**
       * Will read out "message" on the Alexa "device". Returns a Promise which will resolve once Alexa picks
       * up the message. There seems to be very little latency between Alexa picking up the message, and reading
       * it out.
       *
       * However, there is often substantial latency (10+ seconds) waiting for Alexa to pick up the message,
       * so this promise will often take a long time to resolve; be aware of awaiting it!
       */
      async emitSound(device: Device, message: string | string[], ttlInSeconds = 30): Promise<void> {
        if (Array.isArray(message) && message.length > 5) {
          throw new Error('Amazon only allow a maximum of 5 speech segments');
        }

        logger.info('Say called with...');
        logger.info(message);

        let fulfilled = false;
        let resolve: () => void;
        let reject: (error: Error) => void;

        const promise = new Promise<void>((res, rej) => {
          resolve = () => {
            fulfilled = true;
            res();
          };

          reject = (reason) => {
            fulfilled = true;
            rej(reason);
          };
        });

        if (messages.has(device.name)) {
          messages.get(device.name).markMessageAsReplaced();
        }

        messages.set(device.name, {
          getMessageToSend() {
            if (fulfilled) {
              return null;
            }

            resolve();
            return Array.isArray(message) ? message.join('') : message;
          },

          markMessageAsReplaced() {
            if (!fulfilled) {
              const error = 'Message was not picked up by Alexa within the TTL';

              logger.error(error);
              reject(new Error(error));
            }
          }
        });

        setTimeout(() => {
          if (!fulfilled) {
            const error = 'Message was not picked up by Alexa within the TTL';

            logger.error(error);
            reject(new Error(error));
          }
        }, ttlInSeconds * 1000);

        sendSimpleEventSource(device.id);

        return promise;
      }
    };
  },

  async synchronize() {
    for (const { id, name } of config.alexa.devices) {
      let knownDevice = await Device.findByProviderId('alexa', id);

      if (!knownDevice) {
        knownDevice = Device.build({
          provider: 'alexa',
          providerId: id
        });
      }

      knownDevice.manufacturer = 'Amazon';
      knownDevice.model = 'Echo';
      knownDevice.name = name;

      await knownDevice.save();
    }
  }
});

DeviceCapabilityEvents.onButtonPressed(async (event) => {
  const device = await event.getDevice();
  await sendSimpleEventSource(device.id);
});

export const ALARM_ENDPOINT_ID = '044feaa3-6236-48b1-805f-56cd190ae96d';

interface AlexaCapability {
  type: 'AlexaInterface';
  interface: string;
  version: string;
  instance?: string;
  capabilityResources?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
  properties?: {
    supported: { name: string }[];
    configuration?: Record<string, unknown>;
    proactivelyReported: boolean;
    retrievable: boolean;
  };
}

interface AlexaEndpoint {
  friendlyName: string;
  endpointId: string;
  displayCategories: string[];
  manufacturerName: string;
  description: string;
  capabilities: AlexaCapability[];
}

export function buildDiscoveryEndpoints(devices: Device[]): AlexaEndpoint[] {
  const endpoints: AlexaEndpoint[] = [{
    friendlyName: 'Alarm',
    endpointId: ALARM_ENDPOINT_ID,
    displayCategories: ['SECURITY_PANEL'],
    manufacturerName: 'Karen',
    description: 'Security Alarm',
    capabilities: [{
      type: 'AlexaInterface',
      interface: 'Alexa.SecurityPanelController',
      version: '3',
      properties: {
        supported: [{ name: 'armState' }, { name: 'burglaryAlarm' }],
        proactivelyReported: false,
        retrievable: true
      },
      configuration: {
        supportedArmStates: [
          { value: 'ARMED_AWAY' },
          { value: 'ARMED_NIGHT' },
          { value: 'DISARMED' }
        ],
        supportedAuthorizationTypes: []
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa.EndpointHealth',
      version: '3',
      properties: {
        supported: [{ name: 'connectivity' }],
        proactivelyReported: false,
        retrievable: true
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa',
      version: '3'
    }]
  }];

  for (const device of devices) {
    const capabilities = device.getCapabilities();

    if (capabilities.includes('THERMOSTAT')) {
      endpoints.push({
        friendlyName: device.name,
        endpointId: String(device.id),
        displayCategories: ['THERMOSTAT', 'TEMPERATURE_SENSOR'],
        manufacturerName: device.manufacturer,
        description: 'Tado Thermostat',
        capabilities: [{
          type: 'AlexaInterface',
          interface: 'Alexa.TemperatureSensor',
          version: '3',
          properties: {
            supported: [{ name: 'temperature' }],
            proactivelyReported: false,
            retrievable: true
          }
        }, {
          type: 'AlexaInterface',
          interface: 'Alexa.ThermostatController',
          version: '3',
          properties: {
            supported: [{ name: 'targetSetpoint' }],
            configuration: {
              supportsScheduling: true,
              supportedModes: ['HEAT', 'OFF']
            },
            proactivelyReported: false,
            retrievable: true
          }
        }, {
          type: 'AlexaInterface',
          interface: 'Alexa.EndpointHealth',
          version: '3',
          properties: {
            supported: [{ name: 'connectivity' }],
            proactivelyReported: false,
            retrievable: true
          }
        }, {
          type: 'AlexaInterface',
          interface: 'Alexa',
          version: '3'
        }]
      });
    } else if (capabilities.includes('LIGHT')) {
      endpoints.push({
        friendlyName: device.name,
        endpointId: String(device.id),
        displayCategories: ['LIGHT'],
        manufacturerName: device.manufacturer,
        description: `${device.name} light`,
        capabilities: [{
          type: 'AlexaInterface',
          interface: 'Alexa.BrightnessController',
          version: '3',
          properties: {
            supported: [{ name: 'brightness' }],
            proactivelyReported: false,
            retrievable: true
          }
        }, {
          type: 'AlexaInterface',
          interface: 'Alexa.PowerController',
          version: '3',
          properties: {
            supported: [{ name: 'powerState' }],
            proactivelyReported: false,
            retrievable: true
          }
        }, {
          type: 'AlexaInterface',
          interface: 'Alexa',
          version: '3'
        }]
      });
    } else if (capabilities.includes('SPEAKER') || capabilities.includes('BUTTON')) {
      const instanceId = `${device.id}-1`;
      const isButton = capabilities.includes('BUTTON');
      endpoints.push({
        friendlyName: device.name,
        endpointId: String(device.id),
        displayCategories: ['ACTIVITY_TRIGGER'],
        manufacturerName: device.manufacturer,
        description: isButton ? `Button: ${device.name}` : `Event trigger for ${device.name}`,
        capabilities: [{
          type: 'AlexaInterface',
          interface: 'Alexa.SimpleEventSource',
          instance: instanceId,
          version: '1.0',
          capabilityResources: {
            friendlyNames: [{ '@type': 'text', value: { text: isButton ? device.name : 'Synthetic trigger', locale: 'en-US' } }]
          },
          configuration: {
            supportedEvents: [{
              id: 'Button.SinglePush.1',
              friendlyNames: [{ '@type': 'text', value: { text: isButton ? 'Single push' : 'Synthetic trigger', locale: 'en-US' } }]
            }]
          }
        }, {
          type: 'AlexaInterface',
          interface: 'Alexa.EndpointHealth',
          version: '3',
          properties: {
            supported: [{ name: 'connectivity' }],
            proactivelyReported: false,
            retrievable: false
          }
        }, {
          type: 'AlexaInterface',
          interface: 'Alexa',
          version: '3'
        }]
      });
    }
  }

  return endpoints;
}

async function syncDiscovery() {
  if (!config.alexa.refresh_token) {
    return;
  }

  const devices = await Device.findAll();
  const endpoints = buildDiscoveryEndpoints(devices);

  await sendAddOrUpdateReport(endpoints);
  logger.info(`Alexa discovery sync complete: reported ${endpoints.length} endpoints`);
}

nowAndSetInterval(
  createBackgroundTransaction('alexa:discovery-sync', syncDiscovery),
  24 * 60 * 60 * 1000
);
