import React, { useState, useMemo } from 'react';
import { Checkbox, Group, Title } from '@mantine/core';
import { useDeviceHistory } from '../../hooks/queries/use-device-history';
import { useDateRange, DateRangeSelector, getPresetRange } from '../date-range';
import { CapabilityGraph, CapabilityGraphProps } from './capability-graph';
import { usePillToggle } from './pill-toggle';
import { DateRange, DateRangePreset } from '../date-range/types';
import type { GraphConfig } from '../capabilities/types';
import dayjs from '../../dayjs';

type DeviceGraphProps = {
  graphId: string;
  deviceId: number;
  title: string;
  zones?: CapabilityGraphProps['zones'];
  yMin?: number;
  yMax?: number;
  suggestedYMin?: number;
  yAxis?: CapabilityGraphProps['yAxis'];
  toggle?: GraphConfig['toggle'];
  overridePageDateRange?: DateRangePreset;
  overridePageDateRangeStart?: string;
  overridePageDateRangeEnd?: string;
  timeUnit?: CapabilityGraphProps['timeUnit'];
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
  suggestedYMin,
  yAxis,
  toggle,
  overridePageDateRange,
  overridePageDateRangeStart,
  overridePageDateRangeEnd,
  timeUnit
}: DeviceGraphProps) {
  const { globalRange } = useDateRange();
  const [usePageRange, setUsePageRange] = useState(!overridePageDateRange);
  const [localPreset, setLocalPreset] = useState<DateRangePreset>(overridePageDateRange ?? 'last6hours');
  const [localRange, setLocalRange] = useState<DateRange | null>(
    () => getInitialRange(overridePageDateRange, overridePageDateRangeStart, overridePageDateRangeEnd)
  );
  const { value: activeId, control } = usePillToggle(toggle?.map(t => ({ value: t.id, label: t.pillLabel })));

  const effectiveRange = usePageRange ? globalRange : (localRange ?? globalRange);
  const effectiveGraphId = activeId ?? graphId;
  const effectiveYAxis = toggle?.find(t => t.id === activeId)?.yAxis ?? yAxis;

  const params = useMemo(() => ({
    id: effectiveGraphId,
    since: effectiveRange.since.toISOString(),
    until: effectiveRange.until.toISOString()
  }), [effectiveGraphId, effectiveRange.since, effectiveRange.until]);

  const { data, isPending, isError } = useDeviceHistory(deviceId, params);

  const handleUsePageRangeChange = (checked: boolean) => {
    if (!checked && !localRange) {
      setLocalRange(globalRange);
    }
    setUsePageRange(checked);
  };

  if (isPending) {
    return <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  if (isError) {
    return <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading graph</div>;
  }

  if (!data) {
    return null;
  }

  const mergedYAxis = (yMin === undefined && yMax === undefined && suggestedYMin === undefined)
    ? effectiveYAxis
    : { ...effectiveYAxis, y: { ...effectiveYAxis?.y, min: yMin, max: yMax, suggestedMin: suggestedYMin } };

  const graphProps: CapabilityGraphProps = {
    lines: data.lines,
    modes: data.modes,
    bars: data.bars,
    zones,
    yAxis: mergedYAxis,
    timeUnit
  };

  return (
    <div className="device-graph">
      <Group justify="space-between" className="device-graph__controls" mt="lg">
        <Group gap="sm">
          <Title order={4}>{title}</Title>
          {control}
        </Group>
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

      <CapabilityGraph key={effectiveGraphId} {...graphProps} />
    </div>
  );
}
