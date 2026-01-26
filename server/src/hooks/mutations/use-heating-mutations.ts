import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CentralHeatingMode, DHWHeatingMode } from '../../api/types';

interface HeatingUpdateRequest {
  centralHeating?: CentralHeatingMode;
  dhw?: DHWHeatingMode;
}

interface HeatingResponse {
  centralHeating: CentralHeatingMode;
  dhw: DHWHeatingMode;
}

export function useHeatingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: HeatingUpdateRequest): Promise<HeatingResponse> => {
      const res = await fetch('/api/heating', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to update heating: ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['heating'], data);
    },
  });
}
