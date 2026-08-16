import { useDevices } from './use-devices';
import { forDeviceCapability } from '../../helpers/device';

export interface CameraDevice {
  id: number;
  name: string;
  snapshotUrl: string;
}

export function useCameraDevices(): { cameras: CameraDevice[]; isLoading: boolean } {
  const { data, isLoading } = useDevices();

  const cameras = data
    ? forDeviceCapability(data.devices, 'CAMERA', (device, capability) => ({
      id: device.id,
      name: device.name,
      snapshotUrl: capability.snapshotUrl.value,
    }))
    : [];

  return { cameras, isLoading: isLoading || !data };
}
