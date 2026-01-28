import React, { useState, useMemo } from 'react';
import { Checkbox, Group, Title } from '@mantine/core';
import useApiCall from '../../hooks/api';
import { useDateRange, DateRangeSelector, getPresetRange } from '../date-range';
import { CapabilityGraph, CapabilityGraphProps } from './capability-graph';
import { HistoryApiResponse } from '../../api/types';
import { DateRange, DateRangePreset } from '../date-range/types';
import dayjs from '../../dayjs';

type DeviceGraphProps = {
  graphId: string;
  deviceId: number;
  title: string;
  zones?: CapabilityGraphProps['zones'];
  yMin?: number;
  yMax?: number;
  yAxis?: CapabilityGraphProps['yAxis'];
  overridePageDateRange?: DateRangePreset;
  overridePageDateRangeStart?: string;
  overridePageDateRangeEnd?: string;
};

function getInitialRange(
  override?: DateRangePreset,
  start?: string,
  end?: string
): DateRange | null {
  if (!override) return null;

  if (override === 'custom' && start && end) {
    return { since: dayjs(start), until: dayjs(end) };
  }

  return getPresetRange(override);
}

export function DeviceGraph({
  graphId,
  deviceId,
  title,
  zones,
  yMin,
  yMax,
  yAxis,
  overridePageDateRange,
  overridePageDateRangeStart,
  overridePageDateRangeEnd
}: DeviceGraphProps) {
  const { globalRange } = useDateRange();
  const [usePageRange, setUsePageRange] = useState(!overridePageDateRange);
  const [localPreset, setLocalPreset] = useState<DateRangePreset>(overridePageDateRange ?? 'last6hours');
  const [localRange, setLocalRange] = useState<DateRange | null>(
    () => getInitialRange(overridePageDateRange, overridePageDateRangeStart, overridePageDateRangeEnd)
  );

  const effectiveRange = usePageRange ? globalRange : (localRange ?? globalRange);

  const params = useMemo(() => ({
    id: graphId,
    since: effectiveRange.since.toISOString(),
    until: effectiveRange.until.toISOString()
  }), [graphId, effectiveRange.since, effectiveRange.until]);

  const { data, loading, error } = useApiCall<HistoryApiResponse>(
    `/device/${deviceId}/history`,
    params
  );

  const handleUsePageRangeChange = (checked: boolean) => {
    if (!checked && !localRange) {
      setLocalRange(globalRange);
    }
    setUsePageRange(checked);
  };

  if (loading) {
    return <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading graph</div>;
  }

  if (!data) {
    return null;
  }

  const graphProps: CapabilityGraphProps = {
    lines: data.lines,
    modes: data.modes,
    bar: data.bar,
    zones,
    yMin,
    yMax,
    yAxis
  };

  return (
    <div className="device-graph">
      <Group justify="space-between" className="device-graph__controls" mt="lg">
        <Title order={4}>{title}</Title>
        <Group gap="sm">
        {!usePageRange && localRange && (
          <DateRangeSelector
            preset={localPreset}
            range={localRange}
            onPresetChange={setLocalPreset}
            onRangeChange={setLocalRange}
          />
        )}

        <Checkbox
          label="Use page date range"
          checked={usePageRange}
          onChange={(e) => handleUsePageRangeChange(e.currentTarget.checked)}
        />
        </Group>
      </Group>

      <CapabilityGraph {...graphProps} />
    </div>
  );
}
