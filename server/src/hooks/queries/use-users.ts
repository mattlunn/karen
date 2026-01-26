import { useQuery } from '@tanstack/react-query';
import type { UserResponse } from '../../api/types';
import { fetchApi } from '../fetch-api';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => fetchApi<UserResponse[]>('/users'),
  });
}
