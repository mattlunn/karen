import { useQuery } from '@tanstack/react-query';
import type { EnergyInsightsApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useEnergyInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights', params],
    queryFn: () => fetchApi<EnergyInsightsApiResponse>('/insights/energy', params),
  });
}
