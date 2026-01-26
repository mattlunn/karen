import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserResponse, UserUpdateRequest } from '../../api/types';

export function useUserMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UserUpdateRequest): Promise<UserResponse> => {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to update user: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
