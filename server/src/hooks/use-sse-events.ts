import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DevicesApiResponse, RestDeviceResponse, UserResponse } from '../api/types';

interface DeviceUpdateEvent {
  type: 'device_update';
  device: RestDeviceResponse;
}

interface UserUpdateEvent {
  type: 'user_update';
  user: UserResponse;
}

type SSEEvent = DeviceUpdateEvent | UserUpdateEvent | { type: 'connected'; clientId: string };

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
        console.log('SSE connected');
      };

      eventSource.onmessage = (event) => {
        if (!mounted) return;

        try {
          const data = JSON.parse(event.data) as SSEEvent;

          if (data.type === 'connected') {
            console.log('SSE session established:', data.clientId);
            return;
          }

          if (data.type === 'device_update') {
            handleDeviceUpdate(data);
          }

          if (data.type === 'user_update') {
            handleUserUpdate(data);
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
        if (!old) return old;

        return {
          ...old,
          devices: old.devices.map((device: RestDeviceResponse) => {
            if (device.id !== event.device.id) return device;

            return event.device;
          }),
        };
      });
    };

    const handleUserUpdate = (event: UserUpdateEvent) => {
      queryClient.setQueryData(['users'], (old: UserResponse[] | undefined) => {
        if (!Array.isArray(old)) return old;

        return old.map((user) => {
          if (user.id !== event.user.id) return user;
          return event.user;
        });
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
