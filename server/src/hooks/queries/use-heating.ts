import { useQuery } from '@tanstack/react-query';

interface HeatingResponse {
  centralHeating: 'ON' | 'OFF' | 'SETBACK';
  dhw: 'ON' | 'OFF';
}

export function useHeating() {
  return useQuery({
    queryKey: ['heating'],
    queryFn: async (): Promise<HeatingResponse> => {
      const res = await fetch('/api/heating');
      if (!res.ok) {
        if (res.status === 401) {
          window.location.assign('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to fetch heating: ${res.status}`);
      }
      return res.json();
    },
  });
}
