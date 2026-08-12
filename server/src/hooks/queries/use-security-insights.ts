import { useQuery } from '@tanstack/react-query';
import type { SecurityInsightsApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useSecurityInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['security-insights', params],
    queryFn: () => fetchApi<SecurityInsightsApiResponse>('/insights/security', params),
  });
}
