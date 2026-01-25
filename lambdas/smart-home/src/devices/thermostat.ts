import { SmartHomeEndpointProperty } from '../custom-typings/lambda';
import { RestDeviceResponse } from '../custom-typings/karen-types';

export function createResponseProperties(device: RestDeviceResponse, sampleTime: Date, uncertaintyInMilliseconds: number): SmartHomeEndpointProperty[] {
  const thermostatCapability = device.capabilities.find(x => x.type === 'THERMOSTAT');

  if (!thermostatCapability) {
    throw new Error('Thermostat capability not found');
  }

  return [{
    namespace: 'Alexa.TemperatureSensor',
    name: 'temperature',
    value: {
      value: thermostatCapability.currentTemperature.value,
      scale: 'CELSIUS'
    },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  },
  {
    namespace: 'Alexa.ThermostatController',
    name: 'thermostatMode',
    value: thermostatCapability.isHeating.value ? 'HEAT' : 'OFF',
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  },
  {
    namespace: 'Alexa.ThermostatController',
    name: 'targetSetpoint',
    value: {
      value: thermostatCapability.targetTemperature.value,
      'scale': 'CELSIUS'
    },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: {
      value: device.status === 'OK' ? 'OK' : 'UNREACHABLE'
    },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];
}
