import { useQuery } from '@tanstack/react-query';
import type { AlarmStatusResponse } from '../../api/types';

export function useSecurity() {
  return useQuery({
    queryKey: ['security'],
    queryFn: async (): Promise<AlarmStatusResponse> => {
      const res = await fetch('/api/security');
      if (!res.ok) {
        if (res.status === 401) {
          window.location.assign('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to fetch security: ${res.status}`);
      }
      return res.json();
    },
  });
}
