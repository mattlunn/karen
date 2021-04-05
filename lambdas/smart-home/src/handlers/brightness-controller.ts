import { SmartHomeEndpointRequest, SmartHomeResponse, Context } from "../custom-typings/lambda";
import { Light } from "../custom-typings/karen-types";
import { modifyAndCreateResponseObject } from '../devices/light';
import { gql } from '@apollo/client/core';
import client from '../client';

const GET_LIGHTS = gql`
  query GetDevices {
    getLighting {
      lights {
        id
        name
        isOn
        brightness
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
  const response = await client.query<{ getLighting: { lights: Light[] }}>({
    query: GET_LIGHTS
  });

  const id = request.directive.endpoint.endpointId;
  const light = response.data.getLighting.lights.find(x => x.id === id);

  if (light === undefined) {
    throw new Error(`Light ${id} not found`);
  }

  return modifyAndCreateResponseObject(request, {
    id: request.directive.endpoint.endpointId,
    brightness: light.brightness + request.directive.payload.brightnessDelta
  });
}