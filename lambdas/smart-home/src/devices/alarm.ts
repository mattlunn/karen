import { SmartHomeErrorResponse, SmartHomeEndpointRequest, SmartHomeEndpointAndPropertiesResponse, SmartHomeEndpointProperty } from '../custom-typings/lambda';
import { AlarmMode } from '../custom-typings/karen-types';
import { gql } from '@apollo/client/core';
import client from '../client';

const MODIFY_ALARM = gql`
  mutation ModifyAlarm($mode: AlarmMode) {
    updateAlarm(mode: $mode) {
      alarmMode
    }
  }
`;

export async function modifyAndCreateResponseObject<T>(request: SmartHomeEndpointRequest<T>, variables: { mode: AlarmMode }): Promise<SmartHomeErrorResponse | SmartHomeEndpointAndPropertiesResponse> {
  const then = new Date();
  const response = await client.mutate<{ updateAlarm: { alarmMode: AlarmMode }}>({
    mutation: MODIFY_ALARM,
    variables
  });

  const now = new Date();
  const uncertaintyInMilliseconds = now.valueOf() - then.valueOf();
  const mode = response.data?.updateAlarm.alarmMode;

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