import { Device, Arming } from '../../../models';
import { ArmingMode } from '../../../models/arming';
import { AlarmMode } from '../../../api/types';
import { exchangeAuthenticationToken } from './client';
import {
  AlexaSmartHomeRequest,
  AlexaAcceptGrantRequest,
  AlexaDiscoverRequest,
  AlexaReportStateRequest,
  AlexaTurnOnOffRequest,
  AlexaAdjustBrightnessRequest,
  AlexaSecurityPanelRequest,
  AlexaRequestEndpoint
} from './types';
import { ALARM_ENDPOINT_ID, buildDiscoveryEndpoints } from './discovery';

export type AlexaRequestWithEndpoint = Extract<AlexaSmartHomeRequest, { endpoint: AlexaRequestEndpoint }>;

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

export async function handleDiscover(request: AlexaDiscoverRequest) {
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

export async function handleAcceptGrant(request: AlexaAcceptGrantRequest) {
  await exchangeAuthenticationToken('authorization_code', request.payload.grant.code);

  return {
    event: {
      header: { ...request.header, name: 'AcceptGrant.Response' }
    }
  };
}

export async function handleReportState(request: AlexaReportStateRequest) {
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

export async function handleLightControl(request: AlexaRequestWithEndpoint, update: { isOn?: boolean; brightness?: number }) {
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

export async function handleAdjustBrightness(request: AlexaAdjustBrightnessRequest) {
  const id = request.endpoint.endpointId;
  const device = await Device.findByIdOrError(id);
  const light = device.getLightCapability();
  const delta = request.payload.brightnessDelta;
  const newBrightness = Math.max(0, Math.min(100, await light.getBrightness() + delta));

  return handleLightControl(request, { brightness: newBrightness });
}

export async function handleAlarmControl(request: AlexaSecurityPanelRequest) {
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
