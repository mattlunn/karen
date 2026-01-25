import { SmartHomeEndpointRequest, Context, SmartHomeEndpointAndPropertiesResponse, SmartHomeEndpointProperty } from "../custom-typings/lambda";
import { Device, AlarmMode, DeviceApiResponse, AlarmApiResponse } from "../custom-typings/karen-types";
import { createResponseProperties as createLightResponseProperties } from '../devices/light';
import { createResponseProperties as createThermostatResponseProperties } from '../devices/thermostat';
import { createResponseProperties as createAlarmResponseProperties } from '../devices/alarm';
import { apiGet } from '../client';
import { ALARM_ENDPOINT_ID } from "../constants";

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
    const { alarmMode } = await apiGet<AlarmApiResponse>('/security');

    return createStateReport(
      createAlarmResponseProperties(
        alarmMode,
        then,
        Date.now() - then.valueOf()
      )
    );
  } else {
    const { device } = await apiGet<DeviceApiResponse>(`/device/${endpointId}`);

    const capabilityThatDefinesType = device.capabilities.find(({ type }) => type === 'LIGHT' || type === 'THERMOSTAT');

    switch (capabilityThatDefinesType?.type) {
      case 'LIGHT':
        return createStateReport(createLightResponseProperties(device, then, Date.now() - then.valueOf()));

      case 'THERMOSTAT':
        return createStateReport(createThermostatResponseProperties(device, then, Date.now() - then.valueOf()));

      default:
        throw new Error(`Unable to report state on ${request.directive.endpoint.endpointId}`);
    }
  }
}
