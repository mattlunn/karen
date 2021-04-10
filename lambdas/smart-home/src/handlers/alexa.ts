import { SmartHomeEndpointRequest, Context, SmartHomeEndpointAndPropertiesResponse, SmartHomeEndpointProperty } from "../custom-typings/lambda";
import { Light, Thermostat, Device, AlarmMode } from "../custom-typings/karen-types";
import { createResponseProperties as createLightResponseProperties } from '../devices/light';
import { createResponseProperties as createThermostatResponseProperties } from '../devices/thermostat';
import { createResponseProperties as createAlarmResponseProperties } from '../devices/alarm';
import { gql } from '@apollo/client/core';
import client from '../client';
import { ALARM_ENDPOINT_ID } from "../constants";

const GET_DEVICE = gql`
  query GetDevice($id: ID!) {
    getDevice(id: $id) {
      type
      device {
        id
        name
        status

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

const GET_SECURITY_STATUS = gql`
  query GetSecurityStatus {
    getSecurityStatus {
      alarmMode
    }
  }
`;

export async function ReportState(request: SmartHomeEndpointRequest, context: Context): Promise<SmartHomeEndpointAndPropertiesResponse> {
  const then = new Date();
  const endpointId = request.directive.endpoint.endpointId;

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

  if (endpointId === ALARM_ENDPOINT_ID) {
    return createStateReport(
      createAlarmResponseProperties(
        (await client.query<{ getSecurityStatus: { alarmMode: AlarmMode }}>({ query: GET_SECURITY_STATUS })).data.getSecurityStatus.alarmMode,
        then,
        Date.now() - then.valueOf()
      )
    );
  } else {
    const { device, type } = (await client.query<{ getDevice: Device }>({
      query: GET_DEVICE,
      variables: {
        id: endpointId
      }
    })).data.getDevice;

    switch (type) {
      case 'light':
        return createStateReport(createLightResponseProperties(device as Light, then, Date.now() - then.valueOf()));

      case 'thermostat':
        return createStateReport(createThermostatResponseProperties(device as Thermostat, then, Date.now() - then.valueOf()));

      default:
        throw new Error(`Unable to report state on ${request.directive.endpoint.endpointId}`);
    }
  }
}