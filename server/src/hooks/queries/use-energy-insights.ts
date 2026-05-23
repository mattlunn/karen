import { useQuery } from '@tanstack/react-query';
import type { EnergyInsightsSeriesApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useEnergyUsageInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-usage', params],
    queryFn: () => fetchApi<EnergyInsightsSeriesApiResponse>('/insights/energy/usage', params),
  });
}

export function useEnergyCostInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-cost', params],
    queryFn: () => fetchApi<EnergyInsightsSeriesApiResponse>('/insights/energy/cost', params),
  });
}
