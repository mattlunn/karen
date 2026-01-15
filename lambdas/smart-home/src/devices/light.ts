import { SmartHomeErrorResponse, SmartHomeEndpointRequest, SmartHomeEndpointAndPropertiesResponse, SmartHomeEndpointProperty } from '../custom-typings/lambda';
import { Device, LightApiResponse } from '../custom-typings/karen-types';
import { apiPut } from '../client';

export async function modifyAndCreateResponseObject<T>(request: SmartHomeEndpointRequest<T>, variables: { id: string, isOn?: boolean, brightness?: number }): Promise<SmartHomeErrorResponse | SmartHomeEndpointAndPropertiesResponse> {
  const then = new Date();
  const { id, ...body } = variables;

  const response = await apiPut<LightApiResponse>(`/device/${id}/light`, body);

  const now = new Date();
  const uncertaintyInMilliseconds = now.valueOf() - then.valueOf();
  const light = response.device;

  if (light) {
    return {
      event: {
        header: {
          ...request.directive.header,
          namespace: 'Alexa',
          name: 'Response'
        },
        endpoint: {
          ...request.directive.endpoint
        }
      },
      context: {
        properties: createResponseProperties(light, now, uncertaintyInMilliseconds)
      }
    };
  } else {
    return {
      event: {
        header: {
          namespace: 'Alexa',
          name: 'ErrorResponse',
          messageId: request.directive.header.messageId,
          payloadVersion: 3
        },
        endpoint: {
          ...request.directive.endpoint
        },
        payload: {
          type: 'INTERNAL_ERROR',
          message: `Light with id ${variables.id} was not included in the response. Is it a light?`
        }
      }
    }
  }
}

export function createResponseProperties(device: Device, sampleTime: Date, uncertaintyInMilliseconds: number): SmartHomeEndpointProperty[] {
  const light = device.capabilities.find(x => x.type === 'LIGHT');

  if (!light) {
    throw new Error();
  }

  return [{
    namespace: 'Alexa.PowerController',
    name: 'powerState',
    value: light.isOn ? 'ON' : 'OFF',
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.BrightnessController',
    name: 'brightness',
    value: light.brightness,
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
