import { AlarmMode } from '../api/types';
import { LightCapability, ThermostatCapability } from '../models/capabilities';

export interface AlexaEndpointProperty {
  namespace: string;
  name: string;
  value: unknown;
  timeOfSample: string;
  uncertaintyInMilliseconds: number;
}

export async function createLightResponseProperties(light: LightCapability, sampleTime: Date, uncertaintyInMilliseconds: number): Promise<AlexaEndpointProperty[]> {
  const [isOn, brightness] = await Promise.all([light.getIsOn(), light.getBrightness()]);

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
    value: { value: 'OK' },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];
}

export async function createThermostatResponseProperties(thermostat: ThermostatCapability, sampleTime: Date, uncertaintyInMilliseconds: number): Promise<AlexaEndpointProperty[]> {
  const [currentTemperature, targetTemperature, isHeating] = await Promise.all([
    thermostat.getCurrentTemperature(),
    thermostat.getTargetTemperature(),
    thermostat.getIsOn()
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
    value: { value: 'OK' },
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
