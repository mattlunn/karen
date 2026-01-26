import { useQuery } from '@tanstack/react-query';
import type { AlarmStatusResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useSecurity() {
  return useQuery({
    queryKey: ['security'],
    queryFn: () => fetchApi<AlarmStatusResponse>('/security'),
  });
}
