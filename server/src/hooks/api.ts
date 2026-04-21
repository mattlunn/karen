import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

export default function useApiCall<T>(endpoint: string, params?: Record<string, string>) {
  const [data, setData] = useState<null | T>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | Error>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const controllerRef = useRef<null | AbortController>(null);

  const paramsKey = params ? JSON.stringify(params) : '';

  const queryString = useMemo(() => {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }
    return '?' + new URLSearchParams(params).toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  const fullEndpoint = endpoint + queryString;

  const refresh = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    setLoading(true);
    setError(null);
    setFetchKey(k => k + 1);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    fetch(`/api${fullEndpoint}`, { signal: ctrl.signal })
      .then(res => {
        if (!res.ok) {
          if (res.status === 401) {
            window.location.assign('/login');
            return undefined;
          }
          throw new Error(res.status.toString());
        }
        return res.json() as Promise<T>;
      })
      .then(json => {
        if (json !== undefined) {
          setData(json);
          setError(null);
        }
      })
      .catch(err => {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err);
        }
      })
      .finally(() => setLoading(false));

    return () => {
      ctrl.abort();
      controllerRef.current = null;
    };
  }, [fullEndpoint, fetchKey]);

  return { data, loading, error, refresh };
}
