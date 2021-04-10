import { SmartHomeEndpointRequest, SmartHomeResponse, Context } from "../custom-typings/lambda";
import { Device, Light } from "../custom-typings/karen-types";
import { modifyAndCreateResponseObject } from '../devices/light';
import { gql } from '@apollo/client/core';
import client from '../client';

const GET_LIGHT = gql`
  query GetLight($id: ID!) {
    getDevice(id: $id) {
      type
      device {
        ... on Light {
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

  if (getDevice === null || getDevice.type !== 'light') {
    throw new Error(`Light ${id} not found`);
  }

  return modifyAndCreateResponseObject(request, {
    id: request.directive.endpoint.endpointId,
    brightness: Math.max(0, Math.min(100, (getDevice.device as Light).brightness + request.directive.payload.brightnessDelta))
  });
}