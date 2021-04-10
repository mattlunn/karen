import { gql } from '@apollo/client/core';
import { Context } from 'aws-lambda';
import { Light, Thermostat } from '../custom-typings/karen-types';
import { SmartHomeRequest, SmartHomeResponse } from '../custom-typings/lambda';
import client from '../client';
import { ALARM_ENDPOINT_ID } from '../constants';

const GET_DEVICES = gql`
  query GetDevices {
    getHeating {
      thermostats {
        id
        name
        targetTemperature
        currentTemperature
        isHeating
        humidity
        power
      }
    }

    getLighting {
      lights {
        id
        name
        isOn
        brightness
      }
    }
  }
`;

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

type SmartHomeDisplayCategory = 'LIGHT' | 'TEMPERATURE_SENSOR' | 'CHRISTMAS_TREE' | 'THERMOSTAT' | 'SECURITY_PANEL';

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

type SmartHomeDiscoveryResponse = SmartHomeResponse & {
  event: {
    payload: {
      endpoints: SmartHomeEndpoint[]
    }
  }
}

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
  const { data: { getHeating: { thermostats }, getLighting: { lights }}} = await client.query({
    query: GET_DEVICES
  });

  return {
    event: {
      header: {
        messageId: request.directive.header.messageId,
        name: 'Discover.Response',
        namespace: 'Alexa.Discovery',
        payloadVersion: 3
      },

      payload: {
        endpoints: [
          ...thermostats.map(mapThermostatToEndpoints),
          ...lights.map(mapLightToEndpoints),
          createAlarmEndpoint()
        ]
      }
    }
  };
}