import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../fetch-api';
import { HeatingStatusResponse } from '../../api/types';

export function useHeating() {
  return useQuery({
    queryKey: ['heating'],
    queryFn: () => fetchApi<HeatingStatusResponse>('/heating'),
  });
}
