import { useState, useCallback } from 'react';

type HttpMethod = 'PUT' | 'POST' | 'DELETE';

interface MutationResult<TResponse> {
  mutate: (data?: unknown) => Promise<TResponse>;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

export default function useApiMutation<TResponse = unknown>(
  endpoint: string,
  method: HttpMethod = 'PUT'
): MutationResult<TResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const mutate = useCallback(async (data?: unknown): Promise<TResponse> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: data !== undefined ? JSON.stringify(data) : undefined
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || `Request failed with status ${res.status}`);
      }

      return await res.json() as TResponse;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [endpoint, method]);

  return { mutate, loading, error, reset };
}
