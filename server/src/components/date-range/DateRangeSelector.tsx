import React from 'react';
import { SegmentedControl, Group, Stack, Text } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import dayjs from '../../dayjs';
import { useDateRange } from './useDateRange';
import { DateRangePreset } from './types';

const presetOptions = [
  { value: 'last6hours', label: 'Last 6 hours' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'custom', label: 'Custom' },
];

export function DateRangeSelector() {
  const { activePreset, setActivePreset, globalRange, setGlobalRange } = useDateRange();

  return (
    <Stack gap="sm" className="date-range-selector">
      <SegmentedControl
        value={activePreset}
        onChange={(value) => setActivePreset(value as DateRangePreset)}
        data={presetOptions}
      />

      {activePreset === 'custom' && (
        <Group>
          <DateTimePicker
            label="From"
            value={globalRange.since.toDate()}
            onChange={(date) => date && setGlobalRange({
              ...globalRange,
              since: dayjs(date)
            })}
            maxDate={globalRange.until.toDate()}
          />
          <DateTimePicker
            label="To"
            value={globalRange.until.toDate()}
            onChange={(date) => date && setGlobalRange({
              ...globalRange,
              until: dayjs(date)
            })}
            minDate={globalRange.since.toDate()}
            maxDate={new Date()}
          />
        </Group>
      )}

      <Text size="sm" c="dimmed">
        Showing data from {globalRange.since.format('DD/MM/YYYY HH:mm')} to {globalRange.until.format('DD/MM/YYYY HH:mm')}
      </Text>
    </Stack>
  );
}
