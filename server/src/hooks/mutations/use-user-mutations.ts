import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserStatus, UserResponse } from '../../api/types';

export function useUserMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { status?: UserStatus; eta?: number }): Promise<UserResponse> => {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to update user: ${res.status}`);
      return res.json();
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previous = queryClient.getQueryData(['users']);

      queryClient.setQueryData(['users'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((user: any) => {
          if (user.id !== userId) return user;
          return { ...user, ...newData };
        });
      });

      return { previous };
    },
    onError: (err, newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['users'], context.previous);
      }
      console.error('User mutation failed:', err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
