import { useContext } from 'react';
import { DateRangeContext } from './DateRangeContext';
import { DateRangeContextValue } from './types';

export function useDateRange(): DateRangeContextValue {
  const context = useContext(DateRangeContext);

  if (!context) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }

  return context;
}
