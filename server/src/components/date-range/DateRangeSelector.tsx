import React, { useState, useEffect } from 'react';
import { NativeSelect, Group, Button } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import dayjs, { Dayjs } from '../../dayjs';
import { useDateRange } from './useDateRange';
import { getPresetRange } from './DateRangeContext';
import { DateRangePreset, DateRange } from './types';

const presetOptions = [
  { value: 'last6hours', label: 'Last 6 hours' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'custom', label: 'Custom' },
];

type DateRangeSelectorProps = {
  // When provided, uses these values instead of global context
  preset?: DateRangePreset;
  range?: DateRange;
  onPresetChange?: (preset: DateRangePreset) => void;
  onRangeChange?: (range: DateRange) => void;
};

export function DateRangeSelector({ preset, range, onPresetChange, onRangeChange }: DateRangeSelectorProps) {
  const context = useDateRange();

  // Determine if using local (prop-driven) or global (context-driven) mode
  const isLocalMode = preset !== undefined;

  // Use props if provided, otherwise fall back to context
  const activePreset = preset ?? context.activePreset;
  const currentRange = range ?? context.globalRange;
  const setActivePreset = onPresetChange ?? context.setActivePreset;
  const setRange = onRangeChange ?? context.setGlobalRange;

  // Pending state for custom range - only apply on Submit
  const [pendingSince, setPendingSince] = useState<Dayjs>(currentRange.since);
  const [pendingUntil, setPendingUntil] = useState<Dayjs>(currentRange.until);

  // Sync pending state when range changes externally
  useEffect(() => {
    setPendingSince(currentRange.since);
    setPendingUntil(currentRange.until);
  }, [currentRange.since.valueOf(), currentRange.until.valueOf()]);

  const handlePresetChange = (newPreset: DateRangePreset) => {
    setActivePreset(newPreset);
    // For local mode, immediately update range based on preset
    if (isLocalMode && newPreset !== 'custom') {
      setRange(getPresetRange(newPreset));
    }
  };

  const handleSubmitCustomRange = () => {
    setRange({ since: pendingSince, until: pendingUntil });
  };

  return (
    <Group gap="sm" justify="flex-end" className="date-range-selector">
      <NativeSelect
        value={activePreset}
        onChange={(e) => handlePresetChange(e.currentTarget.value as DateRangePreset)}
        data={presetOptions}
        size="xs"
      />

      {activePreset === 'custom' && (
        <>
          <DateTimePicker
            size="xs"
            value={pendingSince.toDate()}
            onChange={(date) => date && setPendingSince(dayjs(date))}
            maxDate={pendingUntil.toDate()}
          />
          <DateTimePicker
            size="xs"
            value={pendingUntil.toDate()}
            onChange={(date) => date && setPendingUntil(dayjs(date))}
            minDate={pendingSince.toDate()}
            maxDate={new Date()}
          />
          <Button size="xs" onClick={handleSubmitCustomRange}>
            Apply
          </Button>
        </>
      )}
    </Group>
  );
}
