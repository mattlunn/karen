import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DevicesApiResponse, DeviceUpdateEvent, RestDeviceResponse, SSEEvent } from '../api/types';

type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useSSEEvents() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [status, setStatus] = useState<SSEStatus>('disconnected');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;

    const connect = () => {
      if (!mounted) return;

      setStatus('connecting');
      const eventSource = new EventSource('/api/events');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mounted) return;
        setStatus('connected');
      };

      eventSource.onmessage = (event) => {
        if (!mounted) return;

        try {
          const data = JSON.parse(event.data) as SSEEvent;

          if (data.type === 'device_update') {
            handleDeviceUpdate(data);
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
        if (!mounted) return;

        console.error('SSE error:', error);
        setStatus('error');

        eventSource.close();

        // Attempt reconnection after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mounted) {
            console.log('Attempting SSE reconnection...');
            connect();
          }
        }, 3000);
      };
    };

    const handleDeviceUpdate = (event: DeviceUpdateEvent) => {
      queryClient.setQueryData(['device', event.device.id], event.device);
      queryClient.setQueryData(['devices'], (old: DevicesApiResponse) => {
        return {
          ...old,
          devices: old.devices.map((device: RestDeviceResponse) => {
            if (device.id !== event.device.id) return device;

            return event.device;
          }),
        };
      });
    };

    connect();

    return () => {
      mounted = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setStatus('disconnected');
    };
  }, [queryClient]);

  return { status };
}
