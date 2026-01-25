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
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['security'] });
      const previous = queryClient.getQueryData(['security']);

      queryClient.setQueryData(['security'], (old: any) => ({
        ...old,
        alarmMode: newData.alarmMode
      }));

      return { previous };
    },
    onError: (err, newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['security'], context.previous);
      }
      console.error('Alarm mutation failed:', err);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['security'], data);
    },
  });
}
