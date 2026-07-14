import React from 'react';
import { useNow } from '../hooks/use-now';
import dayjs from '../dayjs';

export function RelativeDuration({ since }: { since: string }) {
  const now = useNow(60_000);

  return <>{dayjs(since).from(dayjs(now), true)}</>;
}
