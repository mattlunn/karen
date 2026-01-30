import { Dayjs } from '../../dayjs';

export type DateRangePreset = 'last6hours' | 'today' | 'yesterday' | 'custom';

export interface DateRange {
  since: Dayjs;
  until: Dayjs;
}

export interface DateRangeContextValue {
  globalRange: DateRange;
  setGlobalRange: (range: DateRange) => void;
  activePreset: DateRangePreset;
  setActivePreset: (preset: DateRangePreset) => void;
}
