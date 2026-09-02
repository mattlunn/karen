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
  AlexaSetCookingModeRequest,
  AlexaCookByTemperatureRequest,
  AlexaSpeakerRequest,
  AlexaSetVolumeRequest,
  AlexaAdjustVolumeRequest,
  AlexaSetMuteRequest,
  AlexaStepSpeakerRequest,
  AlexaAdjustVolumeStepRequest,
  AlexaSetMuteStepRequest,
  AlexaSelectInputRequest,
  AlexaChangeChannelRequest,
  AlexaLaunchTargetRequest,
  AlexaRequestEndpoint
} from './types';
import { ALARM_ENDPOINT_ID, buildDiscoveryEndpoints } from './discovery';

export type AlexaRequestWithEndpoint = Extract<AlexaSmartHomeRequest, { endpoint: AlexaRequestEndpoint }>;

interface AlexaEndpointProperty {
  namespace: string;
  instance?: string;
  name: string;
  value: unknown;
  timeOfSample: string;
  uncertaintyInMilliseconds: number;
}

type AlexaEndpointPropertyDraft = Omit<AlexaEndpointProperty, 'uncertaintyInMilliseconds'>;

async function getConnectivityValue(device: Device): Promise<'OK' | 'UNREACHABLE'> {
  return await device.getConnectivityCapability().getIsConnected() ? 'OK' : 'UNREACHABLE';
}

async function createLightResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointPropertyDraft[]> {
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
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.BrightnessController',
    name: 'brightness',
    value: brightness,
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: connectivity },
    timeOfSample: sampleTime.toISOString()
  }];
}

async function createThermostatResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointPropertyDraft[]> {
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
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.ThermostatController',
    name: 'thermostatMode',
    value: isHeating ? 'HEAT' : 'OFF',
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.ThermostatController',
    name: 'targetSetpoint',
    value: { value: targetTemperature, scale: 'CELSIUS' },
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: connectivity },
    timeOfSample: sampleTime.toISOString()
  }];
}

async function createSwitchResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointPropertyDraft[]> {
  const sw = device.getSwitchCapability();

  const [isOn, connectivity] = await Promise.all([
    sw.getIsOn(),
    getConnectivityValue(device)
  ]);

  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isOn ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: connectivity },
    timeOfSample: sampleTime.toISOString()
  }];
}

async function createTelevisionResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointPropertyDraft[]> {
  const sw = device.getSwitchCapability();
  const tv = device.getTelevisionCapability();

  const [isOn, volume, isMuted, connectivity] = await Promise.all([
    sw.getIsOn(),
    tv.getVolume(),
    tv.getIsMuted(),
    getConnectivityValue(device)
  ]);

  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isOn ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.Speaker',
    name: 'volume',
    value: volume,
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.Speaker',
    name: 'muted',
    value: isMuted,
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.ChannelController',
    name: 'channel',
    value: {},
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: connectivity },
    timeOfSample: sampleTime.toISOString()
  }];
}

async function createAlarmResponseProperties(sampleTime: Date): Promise<AlexaEndpointPropertyDraft[]> {
  const activeArming = await Arming.getActiveArming();
  const mode: AlarmMode = activeArming ? activeArming.mode as AlarmMode : 'OFF';

  return [{
    namespace: 'Alexa.SecurityPanelController',
    name: 'armState',
    value: mode,
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: 'OK' },
    timeOfSample: sampleTime.toISOString()
  }];
}

function stateReport(request: AlexaRequestWithEndpoint, then: Date, properties: AlexaEndpointPropertyDraft[]) {
  const uncertaintyInMilliseconds = Date.now() - then.valueOf();

  return {
    event: {
      header: { ...request.header, name: 'StateReport' },
      endpoint: request.endpoint
    },
    context: { properties: properties.map((property) => ({ ...property, uncertaintyInMilliseconds })) }
  };
}

function controlResponse(request: AlexaRequestWithEndpoint, then: Date, properties: AlexaEndpointPropertyDraft[]) {
  const uncertaintyInMilliseconds = Date.now() - then.valueOf();

  return {
    event: {
      header: { ...request.header, namespace: 'Alexa', name: 'Response' },
      endpoint: request.endpoint
    },
    context: { properties: properties.map((property) => ({ ...property, uncertaintyInMilliseconds })) }
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

function toCelsius(temp: { value: number; scale: 'CELSIUS' | 'FAHRENHEIT' | 'KELVIN' }): number {
  if (temp.scale === 'CELSIUS') {
    return temp.value;
  }

  if (temp.scale === 'FAHRENHEIT') {
    return (temp.value - 32) * 5 / 9;
  }

  return temp.value - 273.15;
}

async function createOvenResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointPropertyDraft[]> {
  const oven = device.getOvenCapability();
  const [programEvent, currentTemp, targetTemp, connectivity] = await Promise.all([
    oven.getProgramNameEvent(),
    oven.getCurrentTemperature(),
    oven.getSetpointTemperature(),
    getConnectivityValue(device),
  ]);

  const isRunning = programEvent !== null;
  const runningMinutes = programEvent
    ? Math.max(0, Math.floor((sampleTime.getTime() - programEvent.start.getTime()) / 60_000))
    : 0;
  const props: AlexaEndpointPropertyDraft[] = [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isRunning ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.Cooking',
    name: 'cookingMode',
    value: { value: isRunning ? 'BAKE' : 'OFF' },
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.RangeController',
    instance: 'Oven.RunningTime',
    name: 'rangeValue',
    value: runningMinutes,
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: connectivity },
    timeOfSample: sampleTime.toISOString()
  }];

  if (currentTemp !== null) {
    props.push({
      namespace: 'Alexa.Cooking.TemperatureSensor',
      name: 'currentCookingTemperature',
      value: { value: { value: currentTemp, scale: 'CELSIUS' } },
      timeOfSample: sampleTime.toISOString()
    });
  }

  if (targetTemp !== null) {
    props.push({
      namespace: 'Alexa.Cooking.TemperatureController',
      name: 'targetCookingTemperature',
      value: { value: { value: targetTemp, scale: 'CELSIUS' } },
      timeOfSample: sampleTime.toISOString()
    });
  }

  return props;
}

async function createMicrowaveResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointPropertyDraft[]> {
  const mw = device.getMicrowaveCapability();
  const [programEvent, connectivity] = await Promise.all([
    mw.getProgramNameEvent(),
    getConnectivityValue(device),
  ]);

  const isRunning = programEvent !== null;

  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isRunning ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.Cooking',
    name: 'cookingMode',
    value: { value: isRunning ? 'DEFROST' : 'OFF' },
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: connectivity },
    timeOfSample: sampleTime.toISOString()
  }];
}

async function createDishwasherResponseProperties(device: Device, sampleTime: Date): Promise<AlexaEndpointPropertyDraft[]> {
  const dw = device.getDishwasherCapability();
  const [programEvent, connectivity] = await Promise.all([
    dw.getProgramNameEvent(),
    getConnectivityValue(device),
  ]);

  const isRunning = programEvent !== null;

  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isRunning ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString()
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: connectivity },
    timeOfSample: sampleTime.toISOString()
  }];
}

async function responsePropsForAppliance(device: Device, sampleTime: Date): Promise<AlexaEndpointPropertyDraft[]> {
  const caps = device.getCapabilities();
  if (caps.includes('OVEN')) {
    return createOvenResponseProperties(device, sampleTime);
  }
  if (caps.includes('MICROWAVE')) {
    return createMicrowaveResponseProperties(device, sampleTime);
  }
  return createDishwasherResponseProperties(device, sampleTime);
}

export async function handleOvenSetCookingMode(request: AlexaSetCookingModeRequest): Promise<object> {
  const mode = request.payload?.cookingMode?.value;
  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const then = new Date();

  if (mode === 'OFF') {
    await device.getSwitchCapability().setIsOn(false);
  } else if (device.getCapabilities().includes('OVEN')) {
    const setpoint = await device.getOvenCapability().getSetpointTemperature();
    
    await device.getOvenCapability().setSetpointTemperature(setpoint || 200);
  } else {
    throw new Error(`Cooking mode ${mode} not supported on this appliance`);
  }

  return controlResponse(request, then, await responsePropsForAppliance(device, then));
}

export async function handleOvenCookByTemperature(request: AlexaCookByTemperatureRequest): Promise<object> {
  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const celsius = toCelsius(request.payload.targetCookingTemperature);
  const then = new Date();

  await device.getOvenCapability().setSetpointTemperature(Math.round(celsius));

  return controlResponse(request, then, await responsePropsForAppliance(device, then));
}

export async function handleReportState(request: AlexaReportStateRequest) {
  const endpointId = request.endpoint.endpointId;
  const then = new Date();

  if (endpointId === ALARM_ENDPOINT_ID) {
    return stateReport(request, then, await createAlarmResponseProperties(then));
  }

  const device = await Device.findByIdOrError(endpointId);
  const capabilities = device.getCapabilities();

  if (capabilities.includes('TELEVISION')) {
    return stateReport(request, then, await createTelevisionResponseProperties(device, then));
  } else if (capabilities.includes('LIGHT')) {
    return stateReport(request, then, await createLightResponseProperties(device, then));
  } else if (capabilities.includes('THERMOSTAT')) {
    return stateReport(request, then, await createThermostatResponseProperties(device, then));
  } else if (capabilities.includes('OVEN')) {
    return stateReport(request, then, await createOvenResponseProperties(device, then));
  } else if (capabilities.includes('MICROWAVE')) {
    return stateReport(request, then, await createMicrowaveResponseProperties(device, then));
  } else if (capabilities.includes('DISHWASHER')) {
    return stateReport(request, then, await createDishwasherResponseProperties(device, then));
  } else if (capabilities.includes('SWITCH')) {
    return stateReport(request, then, await createSwitchResponseProperties(device, then));
  } else {
    throw new Error(`Unable to report state for "${device.name}" (${endpointId}), with capabilities: ${capabilities.join(', ') || 'none'}`);
  }
}

export async function handlePowerControl(request: AlexaTurnOnOffRequest) {
  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const capabilities = device.getCapabilities();
  const turnOn = request.header.name === 'TurnOn';
  const then = new Date();

  if (capabilities.includes('LIGHT')) {
    await device.getLightCapability().setIsOn(turnOn);
  } else if (capabilities.includes('SWITCH')) {
    await device.getSwitchCapability().setIsOn(turnOn);
  } else {
    throw new Error(`Endpoint ${request.endpoint.endpointId} does not support PowerController`);
  }

  // Per Alexa's Smart Home API docs, a directive Response only needs to report
  // what changed (plus connectivity) — unlike ReportState, which must report
  // full state. powerState is reported optimistically since we just set it.
  const properties: AlexaEndpointPropertyDraft[] = [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: turnOn ? 'ON' : 'OFF',
    timeOfSample: then.toISOString()
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: await getConnectivityValue(device) },
    timeOfSample: then.toISOString()
  }];

  return controlResponse(request, then, properties);
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

  return controlResponse(request, then, await createLightResponseProperties(device, then));
}

export async function handleTelevisionControl(request: AlexaSpeakerRequest | AlexaStepSpeakerRequest | AlexaSelectInputRequest | AlexaChangeChannelRequest) {
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
  } else if (request.header.namespace === 'Alexa.StepSpeaker') {
    if (request.header.name === 'AdjustVolume') {
      const current = await tv.getVolume();
      await tv.setVolume(Math.max(0, Math.min(100, current + (request as AlexaAdjustVolumeStepRequest).payload.volumeSteps)));
    } else {
      await tv.setIsMuted((request as AlexaSetMuteStepRequest).payload.mute);
    }
  } else {
    const payload = (request as AlexaChangeChannelRequest).payload;
    const name = payload.channelMetadata?.name
      ?? payload.channel?.affiliateCallSign
      ?? payload.channel?.callSign
      ?? payload.channel?.number;

    if (!name) {
      throw new AlexaInvalidValueError(`ChangeChannel directive did not include a channel name (payload: ${JSON.stringify(payload)})`);
    }

    try {
      await tv.setCurrentSource(name);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown channel';
      throw new AlexaInvalidValueError(reason);
    }
  }

  return controlResponse(request, then, await createTelevisionResponseProperties(device, then));
}

// Predefined Alexa launch-target identifiers we act on ("Alexa, open the TV
// guide on the living room TV"). Amazon's launch target reference documents
// "Guide" (shortcut.68228) for this, but in practice "open the TV guide"
// resolves to the "TV_SHOW" target (shortcut.78662) — accept both.
const GUIDE_LAUNCH_TARGET_IDS = [
  'amzn1.alexa-ask-target.shortcut.68228', // Guide
  'amzn1.alexa-ask-target.shortcut.78662', // TV_SHOW
];

export async function handleLauncherControl(request: AlexaLaunchTargetRequest) {
  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const tv = device.getTelevisionCapability();
  const then = new Date();

  if (!GUIDE_LAUNCH_TARGET_IDS.includes(request.payload.identifier)) {
    throw new AlexaInvalidValueError(`Unsupported launch target "${request.payload.identifier}"`);
  }

  await tv.setCurrentSource('TV Guide');

  const properties = await createTelevisionResponseProperties(device, then);

  properties.push({
    namespace: 'Alexa.Launcher',
    name: 'target',
    value: { name: request.payload.name ?? 'Guide', identifier: request.payload.identifier },
    timeOfSample: then.toISOString()
  });

  return controlResponse(request, then, properties);
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

  return controlResponse(request, now, await createAlarmResponseProperties(now));
}
