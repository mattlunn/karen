import { useQuery } from '@tanstack/react-query';
import type { DeviceApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useDevice(deviceId: number) {
  return useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => fetchApi<DeviceApiResponse>(`/device/${deviceId}`),
  });
}
