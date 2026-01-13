import React, { useState, useMemo } from 'react';
import { Checkbox, Group } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import useApiCall from '../../hooks/api';
import { useDateRange } from '../date-range';
import { CapabilityGraph, CapabilityGraphProps } from './capability-graph';
import {
  HistoryDetailsApiResponse,
  NumericEventApiResponse,
  EnumEventApiResponse,
  BooleanEventApiResponse
} from '../../api/types';
import dayjs from '../../dayjs';
import { DateRange } from '../date-range/types';

// Response type from /api/device/:id/history endpoint
type HistoryApiResponse = {
  lines: {
    data: HistoryDetailsApiResponse<NumericEventApiResponse>;
    label: string;
    yAxisID?: string;
  }[];
  modes?: {
    data: HistoryDetailsApiResponse<EnumEventApiResponse | BooleanEventApiResponse>;
    details: {
      value: string | true;
      label: string;
      fillColor?: string;
    }[];
  };
  bar?: {
    data: HistoryDetailsApiResponse<NumericEventApiResponse>;
    label: string;
    yAxisID?: string;
  };
};

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
      <div className="device-graph__controls">
        <Checkbox
          label="Use page date range"
          checked={usePageRange}
          onChange={(e) => handleUsePageRangeChange(e.currentTarget.checked)}
        />

        {!usePageRange && localRange && (
          <Group mt="xs">
            <DateTimePicker
              label="From"
              size="xs"
              value={localRange.since.toDate()}
              onChange={(date) => date && setLocalRange({
                ...localRange,
                since: dayjs(date)
              })}
              maxDate={localRange.until.toDate()}
            />
            <DateTimePicker
              label="To"
              size="xs"
              value={localRange.until.toDate()}
              onChange={(date) => date && setLocalRange({
                ...localRange,
                until: dayjs(date)
              })}
              minDate={localRange.since.toDate()}
              maxDate={new Date()}
            />
          </Group>
        )}
      </div>

      <CapabilityGraph {...graphProps} />
    </div>
  );
}
