import { useQuery } from '@tanstack/react-query';
import type { DevicesApiResponse } from '../../api/types';

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async (): Promise<DevicesApiResponse> => {
      const res = await fetch('/api/devices');
      if (!res.ok) {
        if (res.status === 401) {
          window.location.assign('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to fetch devices: ${res.status}`);
      }
      return res.json();
    },
  });
}
