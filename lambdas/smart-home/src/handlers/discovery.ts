import { gql } from '@apollo/client/core';
import { Context } from 'aws-lambda';
import { Light, Thermostat, BasicDevice, Device } from '../custom-typings/karen-types';
import { SmartHomeRequest, SmartHomeResponse } from '../custom-typings/lambda';
import client from '../client';
import { ALARM_ENDPOINT_ID } from '../constants';

const GET_DEVICES = gql`
query getDevices {
  getDevices {
    type
    device {
      id
      name

      ...on Thermostat {
        targetTemperature
        currentTemperature
        isHeating
        humidity
        power
      }

      ...on Light {
        isOn
        brightness
      }
    }
  }
}`;

interface SmartHomeEndpointAdditionalAttributes {
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  softwareVersion: string;
  customIdentifier: string;
}

interface SmartHomeEndpointCapability {
  type: 'AlexaInterface';
  interface: string;
  version: '3';
  configuration?: any
  properties?: {
    supported: {
      name: string
    }[],
    configuration?: any
    proactivelyReported: boolean;
    retrievable: boolean;
  }
}

type SmartHomeDisplayCategory = 'LIGHT' | 'TEMPERATURE_SENSOR' | 'CHRISTMAS_TREE' | 'THERMOSTAT' | 'SECURITY_PANEL' | 'CONTACT_SENSOR';

// https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-discovery-objects.html
interface SmartHomeEndpoint {
  endpointId: string;
  manufacturerName: string;
  description: string;
  friendlyName: string;
  additionalAttributes?: SmartHomeEndpointAdditionalAttributes;
  // https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-discovery.html#display-categories
  displayCategories: SmartHomeDisplayCategory[];
  capabilities: SmartHomeEndpointCapability[]
}

type SmartHomeDiscoveryResponse = SmartHomeResponse<{
  endpoints: SmartHomeEndpoint[]
}>

function mapThermostatToEndpoints(thermostat: Thermostat): SmartHomeEndpoint {
  return {
    friendlyName: thermostat.name,
    endpointId: thermostat.id,
    displayCategories: ['THERMOSTAT', 'TEMPERATURE_SENSOR'],
    manufacturerName: 'Tado',
    description: 'Tado Thermostat',
    capabilities: [{
      type: 'AlexaInterface',
      interface: 'Alexa.TemperatureSensor',
      version: '3',
      properties: {
        supported: [{
          name: 'temperature'
        }],
        proactivelyReported: false,
        retrievable: true
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa.ThermostatController',
      version: '3',
      properties: {
        supported: [{
          name: 'targetSetpoint'
        }],
        configuration: {
          supportsScheduling: true,
          supportedModes: ['HEAT', 'OFF'],
        },
        proactivelyReported: false,
        retrievable: true
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa.EndpointHealth',
      version: '3',
      properties: {
        supported: [{
            name: 'connectivity'
        }],
        proactivelyReported: false,
        retrievable: true
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa',
      version: '3'
    }]
  };
}

function mapLightToEndpoints(light: Light): SmartHomeEndpoint {
  return {
    friendlyName: light.name,
    endpointId: light.id,
    displayCategories: ['LIGHT'],
    manufacturerName: 'Karen',
    description: `${light.name} light`,
    capabilities: [{
      type: 'AlexaInterface',
      interface: 'Alexa.BrightnessController',
      version: '3',
      properties: {
        supported: [{
          name: 'brightness'
        }],
        proactivelyReported: false,
        retrievable: true
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa.PowerController',
      version: '3',
      properties: {
        supported: [{
          name: 'powerState'
        }],
        proactivelyReported: false,
        retrievable: true
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa',
      version: '3'
    }]
  };
}

function mapAlexaToEndpoints(device: BasicDevice): SmartHomeEndpoint {
  return {
    friendlyName: device.name,
    endpointId: device.name,
    displayCategories: ['CONTACT_SENSOR'],
    manufacturerName: 'Karen',
    description: `Fake sensor for ${device.name}`,
    capabilities: [{
      type: 'AlexaInterface',
      interface: 'Alexa.ContactSensor',
      version: '3',
      properties: {
        supported: [{
          name: 'detectionState'
        }],
        proactivelyReported: true,
        retrievable: false
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa.EndpointHealth',
      version: '3',
      properties: {
        supported: [{
          name: 'connectivity'
        }],
        proactivelyReported: true,
        retrievable: false
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa',
      version: '3'
    }]
  };
}

function createAlarmEndpoint(): SmartHomeEndpoint {
  return {
    friendlyName: 'Alarm',
    endpointId: ALARM_ENDPOINT_ID,
    displayCategories: ['SECURITY_PANEL'],
    manufacturerName: 'Karen',
    description: `Security Alarm`,
    capabilities: [{
      type: 'AlexaInterface',
      interface: 'Alexa.SecurityPanelController',
      version: '3',
      properties: {
        supported: [{
          name: 'armState'
        }, {
          name: 'burglaryAlarm'
        }],
        proactivelyReported: false,
        retrievable: true
      },
      configuration: {
        supportedArmStates: [{
          value: 'ARMED_AWAY'
        }, {
          value: 'ARMED_NIGHT'
        }, {
          value: 'DISARMED'
        }],
        supportedAuthorizationTypes: []
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa.EndpointHealth',
      version: '3',
      properties: {
        supported: [{
          name: 'connectivity'
        }],
        proactivelyReported: false,
        retrievable: true
      }
    }, {
      type: 'AlexaInterface',
      interface: 'Alexa',
      version: '3'
    }]
  };
}

export async function Discover(request: SmartHomeRequest, context: Context): Promise<SmartHomeDiscoveryResponse> {
  const devices = (await client.query<{ getDevices: Device[] }>({
    query: GET_DEVICES
  })).data.getDevices;

  return {
    event: {
      header: {
        messageId: request.directive.header.messageId,
        name: 'Discover.Response',
        namespace: 'Alexa.Discovery',
        payloadVersion: 3
      },
      payload: {
        endpoints: devices.reduce((allDevices, device) => {
          switch (device.type) {
            case 'thermostat':
              allDevices.push(mapThermostatToEndpoints(device.device));
              break;
            case 'light':
              allDevices.push(mapLightToEndpoints(device.device));
              break;
            case 'alexa':
              allDevices.push(mapAlexaToEndpoints(device.device));
              break;
          }

          return allDevices;
        }, new Array<SmartHomeEndpoint>(createAlarmEndpoint()))
      }
    }
  };
}