import React, { useState, useMemo } from 'react';
import { Checkbox, Group } from '@mantine/core';
import useApiCall from '../../hooks/api';
import { useDateRange, DateRangeSelector } from '../date-range';
import { CapabilityGraph, CapabilityGraphProps } from './capability-graph';
import { HistoryApiResponse } from '../../api/types';
import { DateRange, DateRangePreset } from '../date-range/types';

type DeviceGraphProps = {
  graphId: string;
  deviceId: number;
  zones?: CapabilityGraphProps['zones'];
  yMin?: number;
  yMax?: number;
  yAxis?: CapabilityGraphProps['yAxis'];
};

export function DeviceGraph({ graphId, deviceId, zones, yMin, yMax, yAxis }: DeviceGraphProps) {
  const { globalRange } = useDateRange();
  const [usePageRange, setUsePageRange] = useState(true);
  const [localPreset, setLocalPreset] = useState<DateRangePreset>('last6hours');
  const [localRange, setLocalRange] = useState<DateRange | null>(null);

  const effectiveRange = usePageRange ? globalRange : (localRange ?? globalRange);

  const params = useMemo(() => ({
    id: graphId,
    since: effectiveRange.since.toISOString(),
    until: effectiveRange.until.toISOString()
  }), [graphId, effectiveRange.since.valueOf(), effectiveRange.until.valueOf()]);

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
      <Group justify="flex-end" className="device-graph__controls">
        <Checkbox
          label="Use page date range"
          checked={usePageRange}
          onChange={(e) => handleUsePageRangeChange(e.currentTarget.checked)}
        />

        {!usePageRange && localRange && (
          <DateRangeSelector
            preset={localPreset}
            range={localRange}
            onPresetChange={setLocalPreset}
            onRangeChange={setLocalRange}
          />
        )}
      </Group>

      <CapabilityGraph {...graphProps} />
    </div>
  );
}
