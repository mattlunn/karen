import React from 'react';
import { useSSEEvents } from '../hooks/use-sse-events';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useSSEEvents();
  return <>{children}</>;
}
