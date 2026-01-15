import { SmartHomeEndpointProperty } from '../custom-typings/lambda';
import { Device } from '../custom-typings/karen-types';

export function createResponseProperties(device: Device, sampleTime: Date, uncertaintyInMilliseconds: number): SmartHomeEndpointProperty[] {
  const thermostat = device.capabilities.find(x => x.type === 'THERMOSTAT');

  if (!thermostat) {
    throw new Error();
  }

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
      value: device.status === 'OK' ? 'OK' : 'UNREACHABLE'
    },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];
}
