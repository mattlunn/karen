import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

export default function useApiCall<T>(endpoint: string, params?: Record<string, string>) {
  const [data, setData] = useState<null | T>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | Error>(null);
  const controllerRef = useRef<null | AbortController>(null);

  const queryString = useMemo(() => {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }
    return '?' + new URLSearchParams(params).toString();
  }, [params && JSON.stringify(params)]);

  const fullEndpoint = endpoint + queryString;

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api${fullEndpoint}`, { signal });

      if (!res.ok) {
        throw new Error(res.status.toString());
      }

      setData(await res.json() as T);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          return;
        }

        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [fullEndpoint]);

  const refresh = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    controllerRef.current = new AbortController();

    fetchData(controllerRef.current.signal);
  }, [fetchData]);

  useEffect(() => {
    const ctrl = new AbortController();

    controllerRef.current = ctrl;
    fetchData(ctrl.signal);
    return () => {
      ctrl.abort();
      controllerRef.current = null;
    };
  }, [fetchData, fullEndpoint]);

  return { data, loading, error, refresh };
}
