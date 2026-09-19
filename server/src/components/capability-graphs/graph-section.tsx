import React, { useState } from 'react';
import { Checkbox, Group, Title } from '@mantine/core';
import { useDateRange, DateRangeSelector, getPresetRange } from '../date-range';
import { DateRange, DateRangePreset } from '../date-range/types';
import { usePillToggle } from '../pill-toggle';
import { DeviceGraph } from './device-graph';
import type { GraphConfig, GraphSectionConfig } from '../capabilities/types';
import dayjs from '../../dayjs';

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

export function GraphSection({ section, deviceId }: { section: GraphSectionConfig; deviceId: number }) {
  // Widening off the tuple/array union keeps `.find`/`.map` below simple.
  const graphs: GraphConfig[] = section.graphs;
  const { globalRange } = useDateRange();
  const [usePageRange, setUsePageRange] = useState(!section.overridePreset);
  const [localPreset, setLocalPreset] = useState<DateRangePreset>(section.overridePreset ?? 'last6hours');
  const [localRange, setLocalRange] = useState<DateRange | null>(
    () => getInitialRange(section.overridePreset, section.overrideStart, section.overrideEnd)
  );
  const { value: activeId, control } = usePillToggle(
    graphs.length > 1 ? graphs.map((graph) => ({ value: graph.id, label: graph.name ?? graph.id })) : undefined
  );

  const effectiveRange = usePageRange ? globalRange : (localRange ?? globalRange);
  const activeGraph = graphs.find((graph) => graph.id === activeId) ?? graphs[0];

  const handleUsePageRangeChange = (checked: boolean) => {
    if (!checked && !localRange) {
      setLocalRange(globalRange);
    }
    setUsePageRange(checked);
  };

  return (
    <div className="device-graph">
      <Group justify="space-between" className="device-graph__controls" mt="lg">
        <Title order={4}>{section.title}</Title>
        <div style={{ marginLeft: 'auto' }}>{control}</div>
      </Group>

      <Group justify="flex-end" gap="sm" mt="sm">
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

      <DeviceGraph
        key={activeGraph.id}
        deviceId={deviceId}
        graph={activeGraph}
        instanceId={section.instanceId}
        since={effectiveRange.since.toISOString()}
        until={effectiveRange.until.toISOString()}
      />
    </div>
  );
}
