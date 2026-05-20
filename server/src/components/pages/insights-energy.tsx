import React, { useMemo } from 'react';
import { Box, Title } from '@mantine/core';
import { useEnergyInsights } from '../../hooks/queries/use-energy-insights';
import { DateRangeProvider, DateRangeSelector, useDateRange } from '../date-range';
import { CapabilityGraph } from '../capability-graphs/capability-graph';
import PageLoader from '../page-loader';

const yAxisPower = {
  yPower: {
    position: 'left' as const,
    min: 0
  }
};

const yAxisCost = {
  yCost: {
    position: 'left' as const,
    min: 0
  }
};

function EnergyGraphs() {
  const { globalRange } = useDateRange();

  const params = useMemo(() => ({
    since: globalRange.since.toISOString(),
    until: globalRange.until.toISOString()
  }), [globalRange.since, globalRange.until]);

  const { data, isPending, isError } = useEnergyInsights(params);

  if (isPending) {
    return <PageLoader />;
  }

  if (isError) {
    return <Box style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading data</Box>;
  }

  if (!data) {
    return null;
  }

  return (
    <>
      <Title order={4} mt="lg">Usage (W)</Title>
      <CapabilityGraph
        lines={data.usage.map(line => ({ ...line, yAxisID: 'yPower' }))}
        yAxis={yAxisPower}
      />

      <Title order={4} mt="lg">Cost (pence per day)</Title>
      <CapabilityGraph
        lines={data.cost.map(line => ({ ...line, yAxisID: 'yCost' }))}
        yAxis={yAxisCost}
      />
    </>
  );
}

export default function EnergyInsights() {
  return (
    <>
      <Title order={2}>Energy</Title>

      <DateRangeProvider>
        <Box mt="md">
          <DateRangeSelector />
        </Box>

        <EnergyGraphs />
      </DateRangeProvider>
    </>
  );
}
