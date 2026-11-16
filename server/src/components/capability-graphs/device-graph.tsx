import React, { useMemo } from 'react';
import { useDeviceHistory } from '../../hooks/queries/use-device-history';
import { CapabilityGraph } from './capability-graph';
import type { GraphConfig } from '../capabilities/types';
import dayjs from '../../dayjs';

type DeviceGraphProps = {
  deviceId: number;
  graph: GraphConfig;
  instanceId?: string | null;
  since: string;
  until: string;
};

export function DeviceGraph({ deviceId, graph, instanceId, since, until }: DeviceGraphProps) {
  const params = useMemo(() => ({
    id: graph.id,
    ...(instanceId ? { instance: instanceId } : {}),
    since,
    until
  }), [graph.id, instanceId, since, until]);

  const { data, isPending, isError } = useDeviceHistory(deviceId, params);

  if (isPending) {
    return <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  if (isError) {
    return <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading graph</div>;
  }

  if (!data) {
    return null;
  }

  const mergedYAxis = (graph.yMin === undefined && graph.yMax === undefined && graph.suggestedYMin === undefined)
    ? graph.yAxis
    : { ...graph.yAxis, y: { ...graph.yAxis?.y, min: graph.yMin, max: graph.yMax, suggestedMin: graph.suggestedYMin } };

  const markers = dayjs(until).isAfter(dayjs())
    ? [{ at: dayjs().toISOString(), label: 'Now', color: '#fa5252' }, ...(data.markers ?? [])]
    : data.markers;

  return (
    <CapabilityGraph
      lines={data.lines}
      modes={data.modes}
      bars={data.bars}
      zones={graph.zones}
      markers={markers}
      yAxis={mergedYAxis}
      timeUnit={graph.timeUnit}
    />
  );
}
