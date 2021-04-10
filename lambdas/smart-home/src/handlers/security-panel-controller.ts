import { SmartHomeEndpointRequest, SmartHomeResponse, SmartHomeErrorResponse, Context } from "../custom-typings/lambda";
import { modifyAndCreateResponseObject } from '../devices/alarm';

export function Arm(request: SmartHomeEndpointRequest<{ armState: 'ARMED_AWAY' | 'ARMED_NIGHT' }>, context: Context): Promise<SmartHomeResponse | SmartHomeErrorResponse> {
  return modifyAndCreateResponseObject(request, {
    mode: request.directive.payload.armState === 'ARMED_AWAY' ? 'AWAY' : 'NIGHT'
  });
}

export async function Disarm(request: SmartHomeEndpointRequest, context: Context): Promise<SmartHomeResponse | SmartHomeErrorResponse> {
  return modifyAndCreateResponseObject(request, {
    mode: 'OFF'
  });
}