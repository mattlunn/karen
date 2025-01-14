import { SmartHomeEndpointRequest, SmartHomeResponse, Context } from "../custom-typings/lambda";
import { Device } from "../custom-typings/karen-types";
import { modifyAndCreateResponseObject } from '../devices/light';
import { gql } from '@apollo/client/core';
import client from '../client';

const GET_LIGHT = gql`
  query GetLight($id: ID!) {
    getDevice(id: $id) {
      id

      capabilities {
        ...on Light {
          brightness
        }
      }
    }
  }
`;

export function SetBrightness(request: SmartHomeEndpointRequest<{ brightness: number }>, context: Context): Promise<SmartHomeResponse> {
  return modifyAndCreateResponseObject(request, {
    id: request.directive.endpoint.endpointId,
    brightness: request.directive.payload.brightness
  });
}

export async function AdjustBrightness(request: SmartHomeEndpointRequest<{ brightnessDelta: number }>, context: Context): Promise<SmartHomeResponse> {
  const id = request.directive.endpoint.endpointId;
  const { data: { getDevice }} = await client.query<{ getDevice: Device}>({
    query: GET_LIGHT,
    variables: {
      id
    }
  });

  const lightCapability = getDevice.capabilities.find(x => x.__typename === 'Light');

  if (lightCapability === undefined) {
    throw new Error(`Device ${id} does not have 'Light' capability`);
  }

  return modifyAndCreateResponseObject(request, {
    id: request.directive.endpoint.endpointId,
    brightness: Math.max(0, Math.min(100, lightCapability.brightness + request.directive.payload.brightnessDelta))
  });
}