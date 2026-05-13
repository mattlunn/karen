import { useQuery } from '@tanstack/react-query';
import type { HeatingInsightsApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useHeatingInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['heating-insights', params],
    queryFn: () => fetchApi<HeatingInsightsApiResponse>('/insights/heating', params),
  });
}
