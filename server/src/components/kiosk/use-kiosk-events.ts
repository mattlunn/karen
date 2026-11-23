import { useEffect } from 'react';
import type { KioskEvent } from '../../api/types';
import { kioskUrl } from './api';

const RECONNECT_SECONDS = 5;

export function useKioskEvents(onEvent: (event: KioskEvent) => void) {
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      eventSource = new EventSource(kioskUrl('/events'));

      eventSource.onmessage = (message) => {
        onEvent(JSON.parse(message.data) as KioskEvent);
      };

      eventSource.onerror = () => {
        if (eventSource?.readyState === EventSource.CLOSED) {
          reconnectTimer = setTimeout(connect, RECONNECT_SECONDS * 1000);
        }
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [onEvent]);
}
