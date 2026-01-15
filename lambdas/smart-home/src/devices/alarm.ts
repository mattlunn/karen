import { SmartHomeErrorResponse, SmartHomeEndpointRequest, SmartHomeEndpointAndPropertiesResponse, SmartHomeEndpointProperty } from '../custom-typings/lambda';
import { AlarmMode, AlarmUpdateResponse } from '../custom-typings/karen-types';
import { apiPut } from '../client';

export async function modifyAndCreateResponseObject<T>(request: SmartHomeEndpointRequest<T>, variables: { mode: AlarmMode }): Promise<SmartHomeErrorResponse | SmartHomeEndpointAndPropertiesResponse> {
  const then = new Date();

  const response = await apiPut<AlarmUpdateResponse>('/security/alarm', variables);

  const now = new Date();
  const uncertaintyInMilliseconds = now.valueOf() - then.valueOf();
  const mode = response.alarmMode;

  if (mode === variables.mode) {
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
        properties: createResponseProperties(mode, now, uncertaintyInMilliseconds)
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
          message: `Unable to set the Alarm to ${variables.mode}`
        }
      }
    }
  }
}

export function createResponseProperties(mode: AlarmMode, sampleTime: Date, uncertaintyInMilliseconds: number): SmartHomeEndpointProperty[] {
  return [{
    namespace: 'Alexa.SecurityPanelController',
    name: 'armState',
    value: mode,
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }, {
    namespace: 'Alexa.EndpointHealth',
    name: 'connectivity',
    value: {
      value: 'OK'
    },
    timeOfSample: sampleTime.toISOString(),
    uncertaintyInMilliseconds
  }];
}
