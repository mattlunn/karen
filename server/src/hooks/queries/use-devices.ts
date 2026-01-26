import { useQuery } from '@tanstack/react-query';
import type { DevicesApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => fetchApi<DevicesApiResponse>('/devices'),
  });
}
