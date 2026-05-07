import { AlarmMode } from '../api/types';
import { Device } from '../models';

export interface AlexaEndpointProperty {
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

export async function createLightResponseProperties(device: Device, sampleTime: Date, uncertaintyInMilliseconds: number): Promise<AlexaEndpointProperty[]> {
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

export async function createThermostatResponseProperties(device: Device, sampleTime: Date, uncertaintyInMilliseconds: number): Promise<AlexaEndpointProperty[]> {
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
