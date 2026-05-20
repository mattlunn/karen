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
  AlexaBrightnessRequest,
  AlexaSetBrightnessRequest,
  AlexaAdjustBrightnessRequest,
  AlexaSecurityPanelRequest,
  AlexaSpeakerRequest,
  AlexaSetVolumeRequest,
  AlexaAdjustVolumeRequest,
  AlexaSetMuteRequest,
  AlexaSelectInputRequest,
  AlexaChangeChannelRequest,
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
  return await device.getConnectivityCapability().getIsConnected() ? 'OK' : 'UNREACHABLE';
}

async function createLightResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointProperty[]> {
  const uncertaintyInMilliseconds = Date.now() - sampleTime.valueOf();
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

async function createThermostatResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointProperty[]> {
  const uncertaintyInMilliseconds = Date.now() - sampleTime.valueOf();
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

async function createSwitchResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointProperty[]> {
  const uncertaintyInMilliseconds = Date.now() - sampleTime.valueOf();
  const sw = device.getSwitchCapability();

  const [isOn, connectivity] = await Promise.all([
    sw.getIsOn(),
    getConnectivityValue(device)
  ]);

  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isOn ? 'ON' : 'OFF',
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

async function createTelevisionResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointProperty[]> {
  const uncertaintyInMilliseconds = Date.now() - sampleTime.valueOf();
  const sw = device.getSwitchCapability();
  const tv = device.getTelevisionCapability();

  const [isOn, volume, isMuted, connectivity] = await Promise.all([
    sw.getIsOn(),
    tv.getVolume(),
    tv.getIsMuted(),
    getConnectivityValue(device)
  ]);

  // InputController / ChannelController are directive-only here (not declared
  // retrievable in discovery), so only the genuinely-reportable properties
  // are included in the state report.
  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isOn ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.Speaker',
    name: 'volume',
    value: volume,
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.Speaker',
    name: 'muted',
    value: isMuted,
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

async function createAlarmResponseProperties(sampleTime: Date): Promise<AlexaEndpointProperty[]> {
  const uncertaintyInMilliseconds = Date.now() - sampleTime.valueOf();
  const activeArming = await Arming.getActiveArming();
  const mode: AlarmMode = activeArming ? activeArming.mode as AlarmMode : 'OFF';

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
    return stateReport(request, await createAlarmResponseProperties(then));
  }

  const device = await Device.findByIdOrError(endpointId);
  const capabilities = device.getCapabilities();

  if (capabilities.includes('TELEVISION')) {
    return stateReport(request, await createTelevisionResponseProperties(device, then));
  } else if (capabilities.includes('LIGHT')) {
    return stateReport(request, await createLightResponseProperties(device, then));
  } else if (capabilities.includes('THERMOSTAT')) {
    return stateReport(request, await createThermostatResponseProperties(device, then));
  } else if (capabilities.includes('SWITCH')) {
    return stateReport(request, await createSwitchResponseProperties(device, then));
  } else {
    throw new Error(`Unable to report state on ${endpointId}`);
  }
}

export async function handlePowerControl(request: AlexaTurnOnOffRequest) {
  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const capabilities = device.getCapabilities();
  const turnOn = request.header.name === 'TurnOn';
  const then = new Date();

  if (capabilities.includes('TELEVISION') || capabilities.includes('SWITCH')) {
    await device.getSwitchCapability().setIsOn(turnOn);

    const properties = capabilities.includes('TELEVISION')
      ? await createTelevisionResponseProperties(device, then)
      : await createSwitchResponseProperties(device, then);

    return controlResponse(request, properties);
  }

  if (capabilities.includes('LIGHT')) {
    await device.getLightCapability().setIsOn(turnOn);
    return controlResponse(request, await createLightResponseProperties(device, then));
  }

  throw new Error(`Endpoint ${request.endpoint.endpointId} does not support PowerController`);
}

export async function handleLightControl(request: AlexaBrightnessRequest) {
  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const light = device.getLightCapability();
  const then = new Date();

  if (request.header.name === 'SetBrightness') {
    await light.setBrightness((request as AlexaSetBrightnessRequest).payload.brightness);
  } else {
    const delta = (request as AlexaAdjustBrightnessRequest).payload.brightnessDelta;
    await light.setBrightness(Math.max(0, Math.min(100, await light.getBrightness() + delta)));
  }

  return controlResponse(request, await createLightResponseProperties(device, then));
}

export async function handleTelevisionControl(request: AlexaSpeakerRequest | AlexaSelectInputRequest | AlexaChangeChannelRequest) {
  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const tv = device.getTelevisionCapability();
  const then = new Date();

  if (request.header.namespace === 'Alexa.Speaker') {
    if (request.header.name === 'SetVolume') {
      await tv.setVolume((request as AlexaSetVolumeRequest).payload.volume);
    } else if (request.header.name === 'AdjustVolume') {
      const current = await tv.getVolume();
      await tv.setVolume(Math.max(0, Math.min(100, current + (request as AlexaAdjustVolumeRequest).payload.volume)));
    } else {
      await tv.setIsMuted((request as AlexaSetMuteRequest).payload.mute);
    }
  } else {
    const payload = (request as AlexaChangeChannelRequest).payload;
    const name = payload.channelMetadata?.name
      ?? payload.channel?.affiliateCallSign
      ?? payload.channel?.callSign;

    if (!name) {
      throw new AlexaInvalidValueError('ChangeChannel directive did not include a channel name');
    }

    try {
      await tv.setCurrentSource(name);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown channel';
      throw new AlexaInvalidValueError(reason);
    }
  }

  return controlResponse(request, await createTelevisionResponseProperties(device, then));
}

export class AlexaInvalidValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlexaInvalidValueError';
  }
}

export async function handleAlarmControl(request: AlexaSecurityPanelRequest) {
  let alarmMode: AlarmMode;
  if (request.header.name === 'Disarm') {
    alarmMode = 'OFF';
  } else if (request.payload.armState === 'ARMED_AWAY') {
    alarmMode = 'AWAY';
  } else {
    alarmMode = 'NIGHT';
  }

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

  return controlResponse(request, await createAlarmResponseProperties(now));
}
