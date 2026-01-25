import { useQuery } from '@tanstack/react-query';
import type { UserResponse } from '../../api/types';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<UserResponse[]> => {
      const res = await fetch('/api/users');
      if (!res.ok) {
        if (res.status === 401) {
          window.location.assign('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to fetch users: ${res.status}`);
      }
      return res.json();
    },
  });
}
