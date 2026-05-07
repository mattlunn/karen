import { useQuery } from '@tanstack/react-query';
import type { HistoryApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useDeviceHistory(deviceId: number, params: { id: string; since: string; until: string }) {
  return useQuery({
    queryKey: ['device-history', deviceId, params],
    queryFn: () => fetchApi<HistoryApiResponse>(`/device/${deviceId}/history`, params),
  });
}
