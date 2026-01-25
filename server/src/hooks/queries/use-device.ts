import { useQuery } from '@tanstack/react-query';
import type { DeviceApiResponse } from '../../api/types';

export function useDevice(deviceId: number) {
  return useQuery({
    queryKey: ['device', deviceId],
    queryFn: async (): Promise<DeviceApiResponse> => {
      const res = await fetch(`/api/device/${deviceId}`);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.assign('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to fetch device: ${res.status}`);
      }
      return res.json();
    },
  });
}
