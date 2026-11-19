import { useQuery } from '@tanstack/react-query';
import type { SilencingWindowsApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useSilencingWindows() {
  return useQuery({
    queryKey: ['silencing-windows'],
    queryFn: () => fetchApi<SilencingWindowsApiResponse>('/security/silencing-windows'),
  });
}
