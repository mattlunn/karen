import { useQuery } from '@tanstack/react-query';
import type { DeviceTimelineApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useDeviceTimeline(deviceId: number, params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['device-timeline', deviceId, params],
    queryFn: () => fetchApi<DeviceTimelineApiResponse>(`/device/${deviceId}/timeline`, params),
  });
}
