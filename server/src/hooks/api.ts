import { useState, useRef, useCallback, useEffect } from 'react';

export default function useApiCall(endpoint: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<null | Error>(null);
  const controllerRef = useRef<null | AbortController>(null);

  const fetchDevice = useCallback(async (signal) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api${endpoint}`, { signal });

      if (!res.ok) {
        throw new Error(res.status.toString());
      }

      setData(await res.json());
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
  }, [endpoint]);

  const refresh = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    controllerRef.current = new AbortController();

    fetchDevice(controllerRef.current);
  }, [fetchDevice]);

  useEffect(() => {
    const ctrl = new AbortController();

    controllerRef.current = ctrl;
    fetchDevice(ctrl.signal);
    return () => {
      ctrl.abort();
      controllerRef.current = null;
    };
  }, [fetchDevice, endpoint]);

  return { data, loading, error, refresh };
}