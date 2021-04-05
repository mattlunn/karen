import { SmartHomeEndpointRequest, Context, SmartHomeEndpointAndPropertiesResponse, SmartHomeEndpointProperty } from "../custom-typings/lambda";
import { Light, Thermostat } from "../custom-typings/karen-types";
import { createResponseProperties as createLightResponseProperties } from '../devices/light';
import { createResponseProperties as createThermostatResponseProperties } from '../devices/thermostat';
import { gql } from '@apollo/client/core';
import client from '../client';

const GET_DEVICE = gql`
  query GetDevice($id: ID!) {
    getDevice(id: $id) {
      type
      device {
        id
        name

        ... on Light {
          isOn
          brightness
        }

        ... on Thermostat {
          targetTemperature
          currentTemperature
          isHeating
          humidity
          power
        }
      }
    }
  }
`;

export async function ReportState(request: SmartHomeEndpointRequest, context: Context): Promise<SmartHomeEndpointAndPropertiesResponse> {
  const then = new Date();
  const { device, type } = (await client.query<{ getDevice: { type: 'thermostat' | 'light', device: Light | Thermostat }}>({
    query: GET_DEVICE,
    variables: {
      id: request.directive.endpoint.endpointId
    }
  })).data.getDevice;

  function createStateReport(properties: SmartHomeEndpointProperty[]) {
    return {
      event: {
        header: {
          ...request.directive.header,
          name: 'StateReport'
        },

        endpoint: {
          ...request.directive.endpoint
        }
      },

      context: {
        properties
      }
    };
  }

  switch (type) {
    case 'light':
      return createStateReport(createLightResponseProperties(request, device as Light, then, Date.now() - then.valueOf()));

    case 'thermostat':
      return createStateReport(createThermostatResponseProperties(request, device as Thermostat, then, Date.now() - then.valueOf()));

    default:
      throw new Error(`Unable to report state on ${request.directive.endpoint.endpointId}`);
  }
}