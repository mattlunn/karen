import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AlarmMode, AlarmStatusResponse } from '../../api/types';

export function useAlarmMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { alarmMode: AlarmMode }): Promise<AlarmStatusResponse> => {
      const res = await fetch('/api/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to update alarm: ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['security'], data);
    },
  });
}
