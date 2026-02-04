import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../fetch-api';

interface HeatingResponse {
  centralHeating: 'ON' | 'OFF' | 'SETBACK' | null;
  dhw: 'ON' | 'OFF';
  preWarm: {
    startTime: string;
    targetEta: string;
  } | null;
}

export function useHeating() {
  return useQuery({
    queryKey: ['heating'],
    queryFn: () => fetchApi<HeatingResponse>('/heating'),
  });
}
