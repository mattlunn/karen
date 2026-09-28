import React from 'react';
import { GraphChrome } from '../graph-chrome';
import { DeviceGraph } from './device-graph';
import { DateRange } from '../date-range/types';
import type { GraphConfig, GraphSectionConfig } from '../capabilities/types';
import dayjs from '../../dayjs';

function getOverrideRange(section: GraphSectionConfig): DateRange | undefined {
  if (section.overridePreset === 'custom' && section.overrideStart && section.overrideEnd) {
    return { since: dayjs(section.overrideStart), until: dayjs(section.overrideEnd) };
  }

  return undefined;
}

export function GraphSection({ section, deviceId, linkedToPageRangeByDefault }: {
  section: GraphSectionConfig;
  deviceId: number;
  linkedToPageRangeByDefault?: boolean;
}) {
  // Widening off the tuple/array union keeps `.find`/`.map` below simple.
  const graphs: GraphConfig[] = section.graphs;

  return (
    <GraphChrome
      title={section.title}
      pills={graphs.length > 1 ? graphs.map((graph) => ({ value: graph.id, label: graph.name ?? graph.id })) : undefined}
      localPreset={section.overridePreset}
      localRange={getOverrideRange(section)}
      linkedToPageRangeByDefault={linkedToPageRangeByDefault}
    >
      {({ since, until, activeGraphId }) => {
        const activeGraph = graphs.find((graph) => graph.id === activeGraphId) ?? graphs[0];

        return (
          <DeviceGraph
            key={activeGraph.id}
            deviceId={deviceId}
            graph={activeGraph}
            instanceId={section.instanceId}
            since={since}
            until={until}
          />
        );
      }}
    </GraphChrome>
  );
}
