import { useQuery } from '@tanstack/react-query';
import type { EnergyDeviceDailyBreakdownApiResponse, EnergyDeviceUnitRateDailyApiResponse, EnergyPowerInsightsApiResponse, EnergyPriceScheduleApiResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useEnergyPowerInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-power', params],
    queryFn: () => fetchApi<EnergyPowerInsightsApiResponse>('/insights/energy/power', params),
  });
}

export function useEnergyDeviceEnergyDailyInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-device-energy-daily', params],
    queryFn: () => fetchApi<EnergyDeviceDailyBreakdownApiResponse>('/insights/energy/device-energy-daily', params),
  });
}

export function useEnergyDeviceCostDailyInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-device-cost-daily', params],
    queryFn: () => fetchApi<EnergyDeviceDailyBreakdownApiResponse>('/insights/energy/device-cost-daily', params),
  });
}

export function useEnergyPriceScheduleInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-price-schedule', params],
    queryFn: () => fetchApi<EnergyPriceScheduleApiResponse>('/insights/energy/price-schedule', params),
  });
}

export function useEnergyDeviceUnitRateDailyInsights(params: { since: string; until: string }) {
  return useQuery({
    queryKey: ['energy-insights-device-unit-rate-daily', params],
    queryFn: () => fetchApi<EnergyDeviceUnitRateDailyApiResponse>('/insights/energy/device-unit-rate-daily', params),
  });
}
