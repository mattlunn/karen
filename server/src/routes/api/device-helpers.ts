import { Device } from '../../models';
import { DeviceStatus } from '../../api/types';

/**
 * Maps a device to a standardized API response structure.
 *
 * This helper reduces code duplication across device capability endpoints by
 * providing a consistent base response format (id, name, status) that each
 * endpoint can extend with capability-specific data.
 *
 * @param device - The device model instance
 * @param isConnected - Whether the device is currently connected
 * @param capabilityData - Capability-specific data to merge into the response
 * @returns Object with id, name, status, and capability-specific data
 */
export function mapDeviceToResponse<T extends Record<string, unknown>>(
  device: Device,
  isConnected: boolean,
  capabilityData: T
): { id: number; name: string; status: DeviceStatus } & T {
  return {
    id: device.id,
    name: device.name,
    status: isConnected ? 'OK' : 'OFFLINE',
    ...capabilityData
  };
}
