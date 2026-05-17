import config from '../../../config';
import logger from '../../../logger';
import { Device, Arming } from '../../../models';
import { ArmingMode } from '../../../models/arming';
import { AlarmMode } from '../../../api/types';
import { createBackgroundTransaction } from '../../../helpers/newrelic';
import nowAndSetIntervalForTime from '../../../helpers/now-and-set-interval-for-time';
import { exchangeAuthenticationToken, sendAddOrUpdateReport, sendDeleteReport } from './client';
import {
  AlexaSmartHomeRequest,
  AlexaAcceptGrantRequest,
  AlexaDiscoverRequest,
  AlexaReportStateRequest,
  AlexaTurnOnOffRequest,
  AlexaBrightnessRequest,
  AlexaSetBrightnessRequest,
  AlexaAdjustBrightnessRequest,
  AlexaSecurityPanelRequest,
  AlexaRequestEndpoint,
  AlexaDiscoveryEndpoint
} from './types';

// Response property helpers

interface AlexaEndpointProperty {
  namespace: string;
  name: string;
  value: unknown;
  timeOfSample: string;
  uncertaintyInMilliseconds: number;
}

async function getConnectivityValue(device: Device): Promise<'OK' | 'UNREACHABLE'> {
  if (!device.getCapabilities().includes('CONNECTIVITY')) {
    return 'OK';
  }

  const isConnected = await device.getConnectivityCapability().getIsConnected();

  return isConnected ? 'OK' : 'UNREACHABLE';
}

async function createLightResponseProperties(device: Device, sampleTime: Date, uncertaintyInMilliseconds: number): Promise<AlexaEndpointProperty[]> {
  const light = device.getLightCapability();

  const [isOn, brightness, connectivity] = await Promise.all([
    light.getIsOn(),
    light.getBrightness(),
    getConnectivityValue(device)
  ]);

  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isOn ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.BrightnessController',
    name: 'brightness',
    value: brightness,
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: connectivity },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];
}

async function createThermostatResponseProperties(device: Device, sampleTime: Date, uncertaintyInMilliseconds: number): Promise<AlexaEndpointProperty[]> {
  const thermostat = device.getThermostatCapability();

  const [currentTemperature, targetTemperature, isHeating, connectivity] = await Promise.all([
    thermostat.getCurrentTemperature(),
    thermostat.getTargetTemperature(),
    thermostat.getIsOn(),
    getConnectivityValue(device)
  ]);

  return [{
    namespace: 'Alexa.TemperatureSensor',
    name: 'temperature',
    value: { value: currentTemperature, scale: 'CELSIUS' },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.ThermostatController',
    name: 'thermostatMode',
    value: isHeating ? 'HEAT' : 'OFF',
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.ThermostatController',
    name: 'targetSetpoint',
    value: { value: targetTemperature, scale: 'CELSIUS' },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: connectivity },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];
}

function createAlarmResponseProperties(mode: AlarmMode, sampleTime: Date, uncertaintyInMilliseconds: number): AlexaEndpointProperty[] {
  return [{
    namespace: 'Alexa.SecurityPanelController',
    name: 'armState',
    value: mode,
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: 'OK' },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];
}

// Discovery

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

export async function syncDiscovery(): Promise<void> {
  if (!config.alexa.refresh_token) {
    return;
  }

  const allDevices = await Device.findAll({ paranoid: false });
  const activeEndpoints = buildDiscoveryEndpoints(allDevices.filter(d => !d.isSoftDeleted()));
  const deletedEndpointIds = allDevices.filter(d => d.isSoftDeleted()).map(d => String(d.id));

  await sendAddOrUpdateReport(activeEndpoints);

  if (deletedEndpointIds.length > 0) {
    await sendDeleteReport(deletedEndpointIds);
  }

  logger.info(`Alexa discovery sync complete: reported ${activeEndpoints.length} endpoints, deleted ${deletedEndpointIds.length}`);
}

nowAndSetIntervalForTime(
  createBackgroundTransaction('alexa:discovery-sync', syncDiscovery),
  '00:00'
);

// Request handlers

export type AlexaRequestWithEndpoint = Extract<AlexaSmartHomeRequest, { endpoint: AlexaRequestEndpoint }>;

function stateReport(request: AlexaRequestWithEndpoint, properties: AlexaEndpointProperty[]) {
  return {
    event: {
      header: { ...request.header, name: 'StateReport' },
      endpoint: request.endpoint
    },
    context: { properties }
  };
}

function controlResponse(request: AlexaRequestWithEndpoint, properties: AlexaEndpointProperty[]) {
  return {
    event: {
      header: { ...request.header, namespace: 'Alexa', name: 'Response' },
      endpoint: request.endpoint
    },
    context: { properties }
  };
}

async function handleDiscover(request: AlexaDiscoverRequest) {
  const devices = await Device.findAll();
  const endpoints = buildDiscoveryEndpoints(devices);

  return {
    event: {
      header: {
        namespace: 'Alexa.Discovery',
        name: 'Discover.Response',
        messageId: request.header.messageId,
        payloadVersion: request.header.payloadVersion
      },
      payload: { endpoints }
    }
  };
}

async function handleAcceptGrant(request: AlexaAcceptGrantRequest) {
  await exchangeAuthenticationToken('authorization_code', request.payload.grant.code);

  return {
    event: {
      header: { ...request.header, name: 'AcceptGrant.Response' }
    }
  };
}

async function handleReportState(request: AlexaReportStateRequest) {
  const endpointId = request.endpoint.endpointId;
  const then = new Date();

  if (endpointId === ALARM_ENDPOINT_ID) {
    const activeArming = await Arming.getActiveArming();
    const alarmMode: AlarmMode = activeArming ? activeArming.mode as AlarmMode : 'OFF';

    return stateReport(request, createAlarmResponseProperties(alarmMode, then, Date.now() - then.valueOf()));
  }

  const device = await Device.findByIdOrError(endpointId);
  const capabilities = device.getCapabilities();

  if (capabilities.includes('LIGHT')) {
    return stateReport(request, await createLightResponseProperties(device, then, Date.now() - then.valueOf()));
  } else if (capabilities.includes('THERMOSTAT')) {
    return stateReport(request, await createThermostatResponseProperties(device, then, Date.now() - then.valueOf()));
  } else {
    throw new Error(`Unable to report state on ${endpointId}`);
  }
}

async function handleLightControl(request: AlexaRequestWithEndpoint, update: { isOn?: boolean; brightness?: number }) {
  const id = request.endpoint.endpointId;
  const device = await Device.findByIdOrError(id);
  const light = device.getLightCapability();
  const then = new Date();

  if ('brightness' in update && update.brightness !== undefined) {
    await light.setBrightness(update.brightness);
  } else if ('isOn' in update && update.isOn !== undefined) {
    await light.setIsOn(update.isOn);
  }

  return controlResponse(request, await createLightResponseProperties(device, then, Date.now() - then.valueOf()));
}

async function handleAdjustBrightness(request: AlexaAdjustBrightnessRequest) {
  const id = request.endpoint.endpointId;
  const device = await Device.findByIdOrError(id);
  const light = device.getLightCapability();
  const delta = request.payload.brightnessDelta;
  const newBrightness = Math.max(0, Math.min(100, await light.getBrightness() + delta));

  return handleLightControl(request, { brightness: newBrightness });
}

async function handleAlarmControl(request: AlexaSecurityPanelRequest) {
  const alarmMode: AlarmMode = request.header.name === 'Disarm' ? 'OFF' :
    request.payload.armState === 'ARMED_AWAY' ? 'AWAY' : 'NIGHT';

  const currentArming = await Arming.getActiveArming();
  const now = new Date();

  if (!((currentArming === null && alarmMode === 'OFF') || currentArming?.mode === alarmMode)) {
    if (currentArming !== null) {
      currentArming.end = now;
      await currentArming.save();
    }

    if (alarmMode !== 'OFF') {
      await Arming.create({
        start: now,
        mode: alarmMode === 'AWAY' ? ArmingMode.AWAY : ArmingMode.NIGHT
      });
    }
  }

  return controlResponse(request, createAlarmResponseProperties(alarmMode, now, 0));
}

export type SmartHomeRequestHandler = (r: AlexaSmartHomeRequest) => Promise<object>;

export const smarthomeHandlers: Record<string, SmartHomeRequestHandler> = {
  'Alexa.Discovery': (r) => handleDiscover(r as AlexaDiscoverRequest),
  'Alexa.Authorization': (r) => handleAcceptGrant(r as AlexaAcceptGrantRequest),
  'Alexa': (r) => handleReportState(r as AlexaReportStateRequest),
  'Alexa.PowerController': (r) => handleLightControl(r as AlexaTurnOnOffRequest, { isOn: r.header.name === 'TurnOn' }),
  'Alexa.BrightnessController': (r) => {
    const brightnessRequest = r as AlexaBrightnessRequest;

    if (brightnessRequest.header.name === 'SetBrightness') {
      return handleLightControl(brightnessRequest as AlexaSetBrightnessRequest, { brightness: (brightnessRequest as AlexaSetBrightnessRequest).payload.brightness });
    }

    return handleAdjustBrightness(brightnessRequest as AlexaAdjustBrightnessRequest);
  },
  'Alexa.SecurityPanelController': (r) => handleAlarmControl(r as AlexaSecurityPanelRequest)
};
