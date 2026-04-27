import { RestDeviceResponse, AlarmMode } from '../api/types';

export interface AlexaEndpointProperty {
  namespace: string;
  name: string;
  value: unknown;
  timeOfSample: string;
  uncertaintyInMilliseconds: number;
}

export function createLightResponseProperties(device: RestDeviceResponse, sampleTime: Date, uncertaintyInMilliseconds: number): AlexaEndpointProperty[] {
  const lightCapability = device.capabilities.find(c => c.type === 'LIGHT');

  if (!lightCapability || lightCapability.type !== 'LIGHT') {
    throw new Error('Light capability not found');
  }

  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: lightCapability.isOn.value ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.BrightnessController',
    name: 'brightness',
    value: lightCapability.brightness.value,
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: device.status === 'OK' ? 'OK' : 'UNREACHABLE' },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];
}

export function createThermostatResponseProperties(device: RestDeviceResponse, sampleTime: Date, uncertaintyInMilliseconds: number): AlexaEndpointProperty[] {
  const thermostatCapability = device.capabilities.find(c => c.type === 'THERMOSTAT');

  if (!thermostatCapability || thermostatCapability.type !== 'THERMOSTAT') {
    throw new Error('Thermostat capability not found');
  }

  return [{
    namespace: 'Alexa.TemperatureSensor',
    name: 'temperature',
    value: { value: thermostatCapability.currentTemperature.value, scale: 'CELSIUS' },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.ThermostatController',
    name: 'thermostatMode',
    value: thermostatCapability.isHeating.value ? 'HEAT' : 'OFF',
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.ThermostatController',
    name: 'targetSetpoint',
    value: { value: thermostatCapability.targetTemperature.value, scale: 'CELSIUS' },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: { value: device.status === 'OK' ? 'OK' : 'UNREACHABLE' },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];
}

export function createAlarmResponseProperties(mode: AlarmMode, sampleTime: Date, uncertaintyInMilliseconds: number): AlexaEndpointProperty[] {
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
