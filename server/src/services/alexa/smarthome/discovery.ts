import { Device } from '../../../models';
import { AlexaDiscoveryEndpoint } from './types';

export const ALARM_ENDPOINT_ID = '044feaa3-6236-48b1-805f-56cd190ae96d';

export function buildDiscoveryEndpoints(devices: Device[]): AlexaDiscoveryEndpoint[] {
  const endpoints: AlexaDiscoveryEndpoint[] = [{
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

    if (capabilities.includes('TELEVISION')) {

      endpoints.push({
        friendlyName: device.name,
        endpointId: String(device.id),
        displayCategories: ['TV'],
        manufacturerName: device.manufacturer,
        description: `${device.name} television`,
        capabilities: [{
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
          interface: 'Alexa.Speaker',
          version: '3',
          properties: {
            supported: [{ name: 'volume' }, { name: 'muted' }],
            proactivelyReported: false,
            retrievable: true
          }
        }, {
          type: 'AlexaInterface',
          interface: 'Alexa.ChannelController',
          version: '3',
          properties: {
            supported: [{ name: 'channel' }],
            proactivelyReported: false,
            retrievable: false
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
    } else if (capabilities.includes('THERMOSTAT')) {
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
    } else if (capabilities.includes('SWITCH')) {
      endpoints.push({
        friendlyName: device.name,
        endpointId: String(device.id),
        displayCategories: ['SWITCH'],
        manufacturerName: device.manufacturer,
        description: `${device.name} switch`,
        capabilities: [{
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
    } else if (capabilities.includes('SPEAKER')) {
      const instanceId = `${device.id}-1`;
      endpoints.push({
        friendlyName: device.name,
        endpointId: String(device.id),
        displayCategories: ['ACTIVITY_TRIGGER'],
        manufacturerName: device.manufacturer,
        description: `Event trigger for ${device.name}`,
        capabilities: [{
          type: 'AlexaInterface',
          interface: 'Alexa.SimpleEventSource',
          instance: instanceId,
          version: '1.0',
          capabilityResources: {
            friendlyNames: [{ '@type': 'text', value: { text: 'Synthetic trigger', locale: 'en-US' } }]
          },
          configuration: {
            supportedEvents: [{
              id: 'Button.SinglePush.1',
              friendlyNames: [{ '@type': 'text', value: { text: 'Synthetic trigger', locale: 'en-US' } }]
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
    } else if (capabilities.includes('BUTTON')) {
      const instanceId = `${device.id}-1`;
      endpoints.push({
        friendlyName: device.name,
        endpointId: String(device.id),
        displayCategories: ['ACTIVITY_TRIGGER'],
        manufacturerName: device.manufacturer,
        description: `Button: ${device.name}`,
        capabilities: [{
          type: 'AlexaInterface',
          interface: 'Alexa.SimpleEventSource',
          instance: instanceId,
          version: '1.0',
          capabilityResources: {
            friendlyNames: [{ '@type': 'text', value: { text: device.name, locale: 'en-US' } }]
          },
          configuration: {
            supportedEvents: [{
              id: 'Button.SinglePush.1',
              friendlyNames: [{ '@type': 'text', value: { text: 'Single push', locale: 'en-US' } }]
            }]
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
