import { SmartHomeErrorResponse, SmartHomeEndpointRequest, SmartHomeEndpointAndPropertiesResponse, SmartHomeEndpointProperty } from "../custom-typings/lambda";
import { Light } from "../custom-typings/karen-types";
import { gql } from '@apollo/client/core';
import client from '../client';

const MODIFY_LIGHT = gql`
  mutation ModifyLight($id: ID!, $isOn: Boolean, $brightness: Int) {
    updateLight(id: $id, isOn: $isOn, brightness: $brightness) {
      lights {
        id
        isOn
        brightness
      }
    }
  }
`;

export async function modifyAndCreateResponseObject(request: SmartHomeEndpointRequest, variables: { id: string, isOn?: boolean, brightness?: number }): Promise<SmartHomeErrorResponse | SmartHomeEndpointAndPropertiesResponse> {
  const then = new Date();
  const response = await client.mutate<{ updateLight: { lights: Light[] }}>({
    mutation: MODIFY_LIGHT,
    variables
  });

  const now = new Date();
  const uncertaintyInMilliseconds = now.valueOf() - then.valueOf();
  const light = response.data?.updateLight.lights.find(x => x.id === variables.id);

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
        properties: createResponseProperties(request, light, now, uncertaintyInMilliseconds)
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

export function createResponseProperties(request: SmartHomeEndpointRequest, light: Light, sampleTime: Date, uncertaintyInMilliseconds: number): SmartHomeEndpointProperty[] {
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
  }];
}