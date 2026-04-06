import type { CapabilityApiResponse, RestDeviceResponse } from '../api/types';

export function forDeviceCapability<T extends CapabilityApiResponse['type'], R>(
  devices: RestDeviceResponse[],
  type: T,
  mapper: (device: RestDeviceResponse, capability: Extract<CapabilityApiResponse, { type: T }>) => R
): R[] {
  return devices.flatMap(device => {
    const cap = device.capabilities.find((c): c is Extract<CapabilityApiResponse, { type: T }> => c.type === type);
    return cap ? [mapper(device, cap)] : [];
  });
}
