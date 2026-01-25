import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface DeviceUpdateEvent {
  type: 'device_update';
  deviceId: number;
  capability: string;
  field: string;
  value: any;
  start: string;
  end: string | null;
}

interface UserUpdateEvent {
  type: 'user_update';
  userId: string;
  status: 'HOME' | 'AWAY';
  since: number | null;
  until: number | null;
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
      const { deviceId, capability, field, value, start, end } = event;

      // Update individual device cache
      queryClient.setQueryData(['device', deviceId], (old: any) => {
        if (!old) return old;

        return {
          ...old,
          device: {
            ...old.device,
            capabilities: old.device.capabilities.map((cap: any) => {
              if (cap.type !== capability) return cap;

              return {
                ...cap,
                [field]: {
                  start,
                  end,
                  value,
                },
              };
            }),
          },
        };
      });

      // Update devices list cache
      queryClient.setQueryData(['devices'], (old: any) => {
        if (!old) return old;

        return {
          ...old,
          devices: old.devices.map((device: any) => {
            if (device.id !== deviceId) return device;

            return {
              ...device,
              capabilities: device.capabilities.map((cap: any) => {
                if (cap.type !== capability) return cap;

                return {
                  ...cap,
                  [field]: {
                    start,
                    end,
                    value,
                  },
                };
              }),
            };
          }),
        };
      });
    };

    const handleUserUpdate = (event: UserUpdateEvent) => {
      const { userId, status: userStatus, since, until } = event;

      queryClient.setQueryData(['users'], (old: any) => {
        if (!Array.isArray(old)) return old;

        return old.map((user: any) => {
          if (user.id !== userId) return user;

          return {
            ...user,
            status: userStatus,
            since,
            until,
          };
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
