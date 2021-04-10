import { SmartHomeEndpointProperty } from '../custom-typings/lambda';
import { Thermostat } from '../custom-typings/karen-types';

export function createResponseProperties(thermostat: Thermostat, sampleTime: Date, uncertaintyInMilliseconds: number): SmartHomeEndpointProperty[] {
  return [{
    namespace: 'Alexa.TemperatureSensor',
    name: 'temperature',
    value: {
      value: thermostat.currentTemperature,
      scale: 'CELSIUS'
    },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  },
  {
    namespace: 'Alexa.ThermostatController',
    name: 'thermostatMode',
    value: thermostat.isHeating ? 'HEAT' : 'OFF',
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  },
  {
    namespace: 'Alexa.ThermostatController',
    name: 'targetSetpoint',
    value: {
      value: thermostat.targetTemperature,
      'scale': 'CELSIUS'
    },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: {
      value: thermostat.status === 'OK' ? 'OK' : 'UNREACHABLE'
    },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];
}