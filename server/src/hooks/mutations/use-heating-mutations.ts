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
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['heating'] });
      const previous = queryClient.getQueryData(['heating']);

      queryClient.setQueryData(['heating'], (old: any) => ({
        ...old,
        ...newData
      }));

      return { previous };
    },
    onError: (err, newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['heating'], context.previous);
      }
      console.error('Heating mutation failed:', err);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['heating'], data);
    },
  });
}
