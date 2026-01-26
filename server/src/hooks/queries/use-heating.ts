import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../fetch-api';

interface HeatingResponse {
  centralHeating: 'ON' | 'OFF' | 'SETBACK';
  dhw: 'ON' | 'OFF';
}

export function useHeating() {
  return useQuery({
    queryKey: ['heating'],
    queryFn: () => fetchApi<HeatingResponse>('/heating'),
  });
}
