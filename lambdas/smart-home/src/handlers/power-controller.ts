import { SmartHomeEndpointRequest, SmartHomeResponse, SmartHomeErrorResponse, Context } from "../custom-typings/lambda";
import { modifyAndCreateResponseObject } from '../devices/light';

export function TurnOn(request: SmartHomeEndpointRequest, context: Context): Promise<SmartHomeResponse | SmartHomeErrorResponse> {
  return modifyAndCreateResponseObject(request, {
    id: request.directive.endpoint.endpointId,
    isOn: true
  });
}

export async function TurnOff(request: SmartHomeEndpointRequest, context: Context): Promise<SmartHomeResponse | SmartHomeErrorResponse> {
  return modifyAndCreateResponseObject(request, {
    id: request.directive.endpoint.endpointId,
    isOn: false
  });
}