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

async function createAlarmResponseProperties(sampleTime: Date, uncertaintyInMilliseconds: number): Promise<AlexaEndpointProperty[]> {
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

function toCelsius(temp: { value: number; scale: 'CELSIUS' | 'FAHRENHEIT' | 'KELVIN' }): number {
  if (temp.scale === 'CELSIUS') {
    return temp.value;
  }
  if (temp.scale === 'FAHRENHEIT') {
    return (temp.value - 32) * 5 / 9;
  }
  return temp.value - 273.15;
}

async function createOvenResponseProperties(device: Device, sampleTime: Date, uncertaintyInMilliseconds: number): Promise<AlexaEndpointProperty[]> {
  const oven = device.getOvenCapability();
  const [programEvent, currentTemp, targetTemp, connectivity] = await Promise.all([
    oven.getProgramNameEvent(),
    oven.getCurrentTemperature(),
    oven.getSetpointTemperature(),
    getConnectivityValue(device),
  ]);

  const isRunning = programEvent !== null && programEvent.end === null;
  const props: AlexaEndpointProperty[] = [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isRunning ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.Cooking',
    name: 'cookingMode',
    value: { value: isRunning ? 'BAKE' : 'OFF' },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: connectivity },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];

  if (currentTemp !== null) {
    props.push({
      namespace: 'Alexa.Cooking.TemperatureSensor',
      name: 'currentCookingTemperature',
      value: { value: { value: currentTemp, scale: 'CELSIUS' } },
      timeOfSample: sampleTime.toISOString(),
      uncertaintyInMilliseconds
    });
  }

  if (targetTemp !== null) {
    props.push({
      namespace: 'Alexa.Cooking.TemperatureController',
      name: 'targetCookingTemperature',
      value: { value: { value: targetTemp, scale: 'CELSIUS' } },
      timeOfSample: sampleTime.toISOString(),
      uncertaintyInMilliseconds
    });
  }

  return props;
}

async function createMicrowaveResponseProperties(device: Device, sampleTime: Date, uncertaintyInMilliseconds: number): Promise<AlexaEndpointProperty[]> {
  const mw = device.getMicrowaveCapability();
  const [programEvent, connectivity] = await Promise.all([
    mw.getProgramNameEvent(),
    getConnectivityValue(device),
  ]);

  const isRunning = programEvent !== null && programEvent.end === null;
  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isRunning ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.Cooking',
    name: 'cookingMode',
    value: { value: isRunning ? 'DEFROST' : 'OFF' },
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

async function createDishwasherResponseProperties(device: Device, sampleTime: Date, uncertaintyInMilliseconds: number): Promise<AlexaEndpointProperty[]> {
  const dw = device.getDishwasherCapability();
  const [programEvent, connectivity] = await Promise.all([
    dw.getProgramNameEvent(),
    getConnectivityValue(device),
  ]);

  const isRunning = programEvent !== null && programEvent.end === null;
  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: isRunning ? 'ON' : 'OFF',
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

const APPLIANCE_CAPS = ['OVEN', 'MICROWAVE', 'DISHWASHER'] as const;

async function responsePropsForAppliance(device: Device, sampleTime: Date, uncertainty: number): Promise<AlexaEndpointProperty[]> {
  const caps = device.getCapabilities();
  if (caps.includes('OVEN')) {
    return createOvenResponseProperties(device, sampleTime, uncertainty);
  }
  if (caps.includes('MICROWAVE')) {
    return createMicrowaveResponseProperties(device, sampleTime, uncertainty);
  }
  return createDishwasherResponseProperties(device, sampleTime, uncertainty);
}

export async function handleAppliancePowerOff(request: AlexaTurnOnOffRequest): Promise<object> {
  if (request.header.name !== 'TurnOff') {
    throw new Error('Remote start of this appliance is not supported');
  }

  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const { stopHomeConnectProgram } = await import('../../homeconnect');
  await stopHomeConnectProgram(device.providerId);

  const then = new Date();
  return controlResponse(request, await responsePropsForAppliance(device, then, 0));
}

export async function handleApplianceSetCookingMode(request: AlexaSetCookingModeRequest): Promise<object> {
  const mode = request.payload?.cookingMode?.value;
  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const { stopHomeConnectProgram, cookOven } = await import('../../homeconnect');

  if (mode === 'OFF') {
    await stopHomeConnectProgram(device.providerId);
  } else if (device.getCapabilities().includes('OVEN')) {
    const setpoint = await device.getOvenCapability().getSetpointTemperature();
    await cookOven(device.providerId, setpoint || 180);
  } else {
    throw new Error(`Cooking mode ${mode} not supported on this appliance`);
  }

  const then = new Date();
  return controlResponse(request, await responsePropsForAppliance(device, then, 0));
}

export async function handleOvenCookByTemperature(request: AlexaCookByTemperatureRequest): Promise<object> {
  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const celsius = toCelsius(request.payload.targetCookingTemperature);
  const { cookOven } = await import('../../homeconnect');
  await cookOven(device.providerId, Math.round(celsius));

  const then = new Date();
  return controlResponse(request, await responsePropsForAppliance(device, then, 0));
}

export async function handleReportState(request: AlexaReportStateRequest) {
  const endpointId = request.endpoint.endpointId;
  const then = new Date();

  if (endpointId === ALARM_ENDPOINT_ID) {
    return stateReport(request, await createAlarmResponseProperties(then, Date.now() - then.valueOf()));
  }

  const device = await Device.findByIdOrError(endpointId);
  const capabilities = device.getCapabilities();

  if (capabilities.includes('LIGHT')) {
    return stateReport(request, await createLightResponseProperties(device, then, Date.now() - then.valueOf()));
  } else if (capabilities.includes('THERMOSTAT')) {
    return stateReport(request, await createThermostatResponseProperties(device, then, Date.now() - then.valueOf()));
  } else if (capabilities.some(c => (APPLIANCE_CAPS as readonly string[]).includes(c))) {
    return stateReport(request, await responsePropsForAppliance(device, then, Date.now() - then.valueOf()));
  } else {
    throw new Error(`Unable to report state on ${endpointId}`);
  }
}

export async function handleLightControl(request: AlexaTurnOnOffRequest | AlexaBrightnessRequest) {
  const device = await Device.findByIdOrError(request.endpoint.endpointId);
  const light = device.getLightCapability();
  const then = new Date();

  if (request.header.namespace === 'Alexa.PowerController') {
    await light.setIsOn(request.header.name === 'TurnOn');
  } else if (request.header.name === 'SetBrightness') {
    await light.setBrightness((request as AlexaSetBrightnessRequest).payload.brightness);
  } else {
    const delta = (request as AlexaAdjustBrightnessRequest).payload.brightnessDelta;
    await light.setBrightness(Math.max(0, Math.min(100, await light.getBrightness() + delta)));
  }

  return controlResponse(request, await createLightResponseProperties(device, then, Date.now() - then.valueOf()));
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

  return controlResponse(request, await createAlarmResponseProperties(now, 0));
}
