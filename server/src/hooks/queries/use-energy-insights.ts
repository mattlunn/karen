import { useQuery } from '@tanstack/react-query';
import type { EnergyCostInsightsApiResponse, EnergyUnitRateDailyApiResponse, EnergyUsageInsightsApiResponse, EnergyScheduleApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useEnergyUsageInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-usage', params],
    queryFn: () => fetchApi<EnergyUsageInsightsApiResponse>('/insights/energy/usage', params),
  });
}

export function useEnergyCostInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-cost', params],
    queryFn: () => fetchApi<EnergyCostInsightsApiResponse>('/insights/energy/cost', params),
  });
}

export function useEnergyScheduleInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-schedule', params],
    queryFn: () => fetchApi<EnergyScheduleApiResponse>('/insights/energy/schedule', params),
  });
}

export function useEnergyUnitRateDailyInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-unit-rate-daily', params],
    queryFn: () => fetchApi<EnergyUnitRateDailyApiResponse>('/insights/energy/unit-rate-daily', params),
  });
}
