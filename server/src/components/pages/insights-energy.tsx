import React, { useMemo, useState } from 'react';
import { Box, Group, Title } from '@mantine/core';
import { useEnergyCostInsights, useEnergyScheduleInsights, useEnergyUsageInsights } from '../../hooks/queries/use-energy-insights';
import { DateRangeProvider, DateRangeSelector, getPresetRange } from '../date-range';
import { DateRange, DateRangePreset } from '../date-range/types';
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

const yAxisRate = {
  yRate: {
    position: 'left' as const,
    suggestedMin: 0
  }
};

function useLocalRange(defaultPreset: DateRangePreset) {
  const [preset, setPreset] = useState<DateRangePreset>(defaultPreset);
  const [range, setRange] = useState<DateRange>(() => getPresetRange(defaultPreset));

  const params = useMemo(() => ({
    since: range.since.toISOString(),
    until: range.until.toISOString()
  }), [range.since, range.until]);

  return { preset, setPreset, range, setRange, params };
}

function UsageGraph() {
  const { preset, setPreset, range, setRange, params } = useLocalRange('last6hours');
  const { data, isPending, isError } = useEnergyUsageInsights(params);

  return (
    <>
      <Group justify="space-between" mt="lg">
        <Title order={4}>Usage (W)</Title>
        <DateRangeSelector
          preset={preset}
          range={range}
          onPresetChange={setPreset}
          onRangeChange={setRange}
        />
      </Group>

      {isPending ? <PageLoader /> : isError ? (
        <Box style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading data</Box>
      ) : (
        <CapabilityGraph
          lines={data.series.map(line => ({ ...line, yAxisID: 'yPower' }))}
          yAxis={yAxisPower}
        />
      )}
    </>
  );
}

function CostGraph() {
  const { preset, setPreset, range, setRange, params } = useLocalRange('lastMonth');
  const { data, isPending, isError } = useEnergyCostInsights(params);

  return (
    <>
      <Group justify="space-between" mt="lg">
        <Title order={4}>Cost (£ per day)</Title>
        <DateRangeSelector
          preset={preset}
          range={range}
          onPresetChange={setPreset}
          onRangeChange={setRange}
        />
      </Group>

      {isPending ? <PageLoader /> : isError ? (
        <Box style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading data</Box>
      ) : (
        <CapabilityGraph
          lines={[{ ...data.total, yAxisID: 'yCost', period: 'day' as const }]}
          bars={data.series.map(series => ({ data: series.data, label: series.label, yAxisID: 'yCost', period: 'day' as const }))}
          stacked
          timeUnit="day"
          yAxis={yAxisCost}
        />
      )}
    </>
  );
}

function ScheduleGraph() {
  const { preset, setPreset, range, setRange, params } = useLocalRange('next24hours');
  const { data, isPending, isError } = useEnergyScheduleInsights(params);

  return (
    <>
      <Group justify="space-between" mt="lg">
        <Title order={4}>Price &amp; run windows</Title>
        <DateRangeSelector
          preset={preset}
          range={range}
          onPresetChange={setPreset}
          onRangeChange={setRange}
        />
      </Group>

      {isPending ? <PageLoader /> : isError ? (
        <Box style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading data</Box>
      ) : (
        <CapabilityGraph
          lines={data.lines}
          modes={data.modes}
          yAxis={yAxisRate}
        />
      )}
    </>
  );
}

export default function EnergyInsights() {
  return (
    <>
      <Title order={2}>Energy</Title>

      <DateRangeProvider>
        <UsageGraph />
        <ScheduleGraph />
        <CostGraph />
      </DateRangeProvider>
    </>
  );
}
