import { SmartHomeEndpointRequest, SmartHomeResponse, Context } from "../custom-typings/lambda";
import { DeviceApiResponse } from "../custom-typings/karen-types";
import { modifyAndCreateResponseObject } from '../devices/light';
import { apiGet } from '../client';

export function SetBrightness(request: SmartHomeEndpointRequest<{ brightness: number }>, context: Context): Promise<SmartHomeResponse> {
  return modifyAndCreateResponseObject(request, {
    id: request.directive.endpoint.endpointId,
    brightness: request.directive.payload.brightness
  });
}

export async function AdjustBrightness(request: SmartHomeEndpointRequest<{ brightnessDelta: number }>, context: Context): Promise<SmartHomeResponse> {
  const id = request.directive.endpoint.endpointId;
  const { device } = await apiGet<DeviceApiResponse>(`/device/${id}`);

  const lightCapability = device.capabilities.find(x => x.type === 'LIGHT');

  if (lightCapability === undefined) {
    throw new Error(`Device ${id} does not have 'Light' capability`);
  }

  return modifyAndCreateResponseObject(request, {
    id: request.directive.endpoint.endpointId,
    brightness: Math.max(0, Math.min(100, lightCapability.brightness + request.directive.payload.brightnessDelta))
  });
}
