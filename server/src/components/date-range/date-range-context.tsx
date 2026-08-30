import React, { createContext, useState, ReactNode } from 'react';
import dayjs from '../../dayjs';
import { DateRange, DateRangePreset, DateRangeContextValue } from './types';

export const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function getPresetRange(preset: DateRangePreset): DateRange {
  const now = dayjs();

  switch (preset) {
    case 'last6hours':
      return { since: now.subtract(6, 'hours'), until: now };
    case 'next24hours':
      return { since: now.subtract(6, 'hours'), until: now.add(24, 'hours') };
    case 'today':
      return { since: now.startOf('day'), until: now };
    case 'yesterday':
      return {
        since: now.subtract(1, 'day').startOf('day'),
        until: now.subtract(1, 'day').endOf('day')
      };
    case 'lastMonth':
      return { since: now.subtract(1, 'month').startOf('day'), until: now };
    case 'custom':
    default:
      return { since: now.subtract(6, 'hours'), until: now };
  }
}

interface DateRangeProviderProps {
  children: ReactNode;
  defaultPreset?: DateRangePreset;
  // Overrides the initial range computed from defaultPreset - lets a caller that already
  // computed a range elsewhere (e.g. to also drive a request outside this provider) share the
  // exact same since/until, rather than a second, independently-timestamped equivalent.
  defaultRange?: DateRange;
}

export function DateRangeProvider({ children, defaultPreset = 'last6hours', defaultRange }: DateRangeProviderProps) {
  const [activePreset, setActivePreset] = useState<DateRangePreset>(defaultPreset);
  const [globalRange, setGlobalRange] = useState<DateRange>(() => defaultRange ?? getPresetRange(defaultPreset));

  const handleSetActivePreset = (preset: DateRangePreset) => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      setGlobalRange(getPresetRange(preset));
    }
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
