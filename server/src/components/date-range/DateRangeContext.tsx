import React, { createContext, useState, useEffect, ReactNode } from 'react';
import dayjs from '../../dayjs';
import { DateRange, DateRangePreset, DateRangeContextValue } from './types';

export const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function getPresetRange(preset: DateRangePreset): DateRange {
  const now = dayjs();

  switch (preset) {
    case 'last6hours':
      return { since: now.subtract(6, 'hours'), until: now };
    case 'today':
      return { since: now.startOf('day'), until: now };
    case 'yesterday':
      return {
        since: now.subtract(1, 'day').startOf('day'),
        until: now.subtract(1, 'day').endOf('day')
      };
    case 'custom':
    default:
      return { since: now.subtract(6, 'hours'), until: now };
  }
}

interface DateRangeProviderProps {
  children: ReactNode;
}

export function DateRangeProvider({ children }: DateRangeProviderProps) {
  const [activePreset, setActivePreset] = useState<DateRangePreset>('last6hours');
  const [globalRange, setGlobalRange] = useState<DateRange>(() => getPresetRange('last6hours'));

  useEffect(() => {
    if (activePreset !== 'custom') {
      setGlobalRange(getPresetRange(activePreset));
    }
  }, [activePreset]);

  const handleSetActivePreset = (preset: DateRangePreset) => {
    setActivePreset(preset);
  };

  const handleSetGlobalRange = (range: DateRange) => {
    setGlobalRange(range);
    setActivePreset('custom');
  };

  return (
    <DateRangeContext.Provider value={{
      globalRange,
      setGlobalRange: handleSetGlobalRange,
      activePreset,
      setActivePreset: handleSetActivePreset
    }}>
      {children}
    </DateRangeContext.Provider>
  );
}
