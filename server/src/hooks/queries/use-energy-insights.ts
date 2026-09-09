import { useQuery } from '@tanstack/react-query';
import type { EnergyDeviceUsageApiResponse, EnergyUsageInsightsApiResponse, EnergyScheduleApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useEnergyUsageInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-usage', params],
    queryFn: () => fetchApi<EnergyUsageInsightsApiResponse>('/insights/energy/usage', params),
  });
}

export function useEnergyDeviceUsageInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-device-usage', params],
    queryFn: () => fetchApi<EnergyDeviceUsageApiResponse>('/insights/energy/device-usage', params),
  });
}

export function useEnergyScheduleInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-schedule', params],
    queryFn: () => fetchApi<EnergyScheduleApiResponse>('/insights/energy/schedule', params),
  });
}
