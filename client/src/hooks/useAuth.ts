import { useQuery } from '@tanstack/react-query';
import { getAuthStatus } from '../api/authApi';

export function useAuthStatus(poll = true) {
  const q = useQuery({
    queryKey: ['auth-status'],
    queryFn: getAuthStatus,
    refetchInterval: poll ? 3000 : false,
    staleTime: 0,
  });

  return {
    ...q,
    isAuthenticated: q.data?.authenticated ?? false,
  };
}
