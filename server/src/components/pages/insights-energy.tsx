import React, { useEffect } from 'react';
import { Box, Title } from '@mantine/core';
import { useEnergyCostInsights, useEnergyScheduleInsights, useEnergyUnitRateDailyInsights, useEnergyUsageDailyInsights, useEnergyUsageInsights } from '../../hooks/queries/use-energy-insights';
import { useDevices } from '../../hooks/queries/use-devices';
import { DateRangeProvider, DateRangeSelector } from '../date-range';
import { DateRange, DateRangePreset } from '../date-range/types';
import { CapabilityGraph } from '../capability-graphs/capability-graph';
import { GraphSection } from '../capability-graphs/graph-section';
import { GraphChrome } from '../graph-chrome';
import { getDeviceGraphSection } from '../capabilities';
import PageLoader from '../page-loader';
import dayjs from '../../dayjs';

const yAxisPower = {
  yPower: {
    position: 'left' as const,
    min: 0
  }
};

const yAxisCost = {
  yCost: {
    position: 'left' as const,
    // Not min: 0 - the "Other" residual can go slightly negative when a
    // sub-meter briefly reads above the whole-house meter, and that should show.
    suggestedMin: 0
  }
};

const yAxisDailyEnergy = {
  yEnergy: {
    position: 'left' as const,
    suggestedMin: 0
  }
};

const yAxisRate = {
  yRate: {
    position: 'left' as const,
    suggestedMin: 0
  }
};

// Matches the schedule endpoint's own horizon, which clamps anything longer.
const FORECAST_HORIZON_DAYS = 7;

function GraphState({ isPending, isError, children }: { isPending: boolean; isError: boolean; children: React.ReactNode }) {
  if (isPending) {
    return <PageLoader />;
  }

  if (isError) {
    return <Box style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading data</Box>;
  }

  return <>{children}</>;
}

function UsageGraph() {
  return (
    <GraphChrome title="Usage (W)" localPreset="last6hours">
      {({ since, until }) => <UsageGraphBody since={since} until={until} />}
    </GraphChrome>
  );
}

function UsageGraphBody({ since, until }: { since: string; until: string }) {
  const { data, isPending, isError } = useEnergyUsageInsights({ since, until });

  return (
    <GraphState isPending={isPending} isError={isError}>
      {data && (
        <CapabilityGraph
          lines={data.series.map(line => ({ ...line, yAxisID: 'yPower' }))}
          yAxis={yAxisPower}
        />
      )}
    </GraphState>
  );
}

// The whole-house total is the smart meter's own device-page section - the
// ENERGY_MONITOR device that also reports ENERGY_COST - rendered here from the
// same registry config so the two stay identical.
function MeterDailyGraph() {
  const { data: devicesData } = useDevices();

  const meter = devicesData?.devices.find(device =>
    device.capabilities.some(c => c.type === 'ENERGY_MONITOR') &&
    device.capabilities.some(c => c.type === 'ENERGY_COST')
  );
  const section = meter && getDeviceGraphSection(meter, 'energy-daily');

  if (!meter || !section) {
    return <PageLoader />;
  }

  return <GraphSection section={section} deviceId={meter.id} linkedToPageRangeByDefault />;
}

const USAGE_COST_PILLS = [
  { value: 'usage', label: 'Usage' },
  { value: 'cost', label: 'Cost' },
];

function UsageCostGraph() {
  return (
    <GraphChrome title="Per Device Daily Energy & Cost" localPreset="lastMonth" linkedToPageRangeByDefault pills={USAGE_COST_PILLS}>
      {({ since, until, activeGraphId }) => (
        activeGraphId === 'cost'
          ? <CostGraphBody since={since} until={until} />
          : <UsageDailyGraphBody since={since} until={until} />
      )}
    </GraphChrome>
  );
}

function UsageDailyGraphBody({ since, until }: { since: string; until: string }) {
  const { data, isPending, isError } = useEnergyUsageDailyInsights({ since, until });

  return (
    <GraphState isPending={isPending} isError={isError}>
      {data && (
        <CapabilityGraph
          lines={[]}
          bars={data.series.map(series => ({ data: series.data, label: series.label, yAxisID: 'yEnergy', period: 'day' as const, hatched: series.role === 'residual' }))}
          stacked
          timeUnit="day"
          yAxis={yAxisDailyEnergy}
        />
      )}
    </GraphState>
  );
}

function CostGraphBody({ since, until }: { since: string; until: string }) {
  const { data, isPending, isError } = useEnergyCostInsights({ since, until });

  return (
    <GraphState isPending={isPending} isError={isError}>
      {data && (
        <CapabilityGraph
          lines={[]}
          bars={data.series.map(series => ({ data: series.data, label: series.label, yAxisID: 'yCost', period: 'day' as const, hatched: series.role === 'residual' }))}
          stacked
          timeUnit="day"
          yAxis={yAxisCost}
        />
      )}
    </GraphState>
  );
}

function UnitRateDailyGraph() {
  return (
    <GraphChrome title="Effective unit rate (p/kWh per day)" localPreset="lastMonth" linkedToPageRangeByDefault>
      {({ since, until }) => <UnitRateDailyGraphBody since={since} until={until} />}
    </GraphChrome>
  );
}

function UnitRateDailyGraphBody({ since, until }: { since: string; until: string }) {
  const { data, isPending, isError } = useEnergyUnitRateDailyInsights({ since, until });

  return (
    <GraphState isPending={isPending} isError={isError}>
      {data && (
        <CapabilityGraph
          lines={data.lines}
          timeUnit="day"
          yAxis={yAxisRate}
        />
      )}
    </GraphState>
  );
}

function ScheduleGraph() {
  return (
    <GraphChrome
      title="Price &amp; run windows"
      localPreset="custom"
      localRange={{ since: dayjs().startOf('day'), until: dayjs().add(FORECAST_HORIZON_DAYS, 'day') }}
    >
      {({ since, until, range, setRange, preset, isLinkedToPageRange }) => (
        <ScheduleGraphBody
          since={since}
          until={until}
          range={range}
          setRange={setRange}
          preset={preset}
          isLinkedToPageRange={isLinkedToPageRange}
        />
      )}
    </GraphChrome>
  );
}

function ScheduleGraphBody({ since, until, range, setRange, preset, isLinkedToPageRange }: {
  since: string;
  until: string;
  range: DateRange;
  setRange: (range: DateRange) => void;
  preset: DateRangePreset;
  isLinkedToPageRange: boolean;
}) {
  const { data, isPending, isError } = useEnergyScheduleInsights({ since, until });

  // The server ends the view where the forecast runs out - reflect that in the
  // Custom range's `until` so the selector matches what's shown. Only while
  // unlinked, since the page range is not this graph's to move.
  const dataUntil = data?.lines[0]?.data.until;

  useEffect(() => {
    if (!isLinkedToPageRange && preset === 'custom' && dataUntil && dataUntil !== range.until.toISOString()) {
      setRange({ since: range.since, until: dayjs(dataUntil) });
    }
  }, [dataUntil, preset, isLinkedToPageRange, range.since, range.until, setRange]);

  return (
    <GraphState isPending={isPending} isError={isError}>
      {data && (
        <CapabilityGraph
          lines={data.lines}
          modes={data.modes}
          yAxis={yAxisRate}
          timeUnit="hour"
          markers={[
            { at: dayjs().toISOString(), label: 'Now', color: '#fa5252' },
            ...(data.forecastFrom ? [{ at: data.forecastFrom, label: 'Forecast', color: '#868e96' }] : []),
          ]}
        />
      )}
    </GraphState>
  );
}

export default function EnergyInsights() {
  return (
    <>
      <Title order={2}>Energy</Title>

      <DateRangeProvider defaultPreset="lastMonth">
        <Box mt="md">
          <DateRangeSelector />
        </Box>

        <UsageGraph />
        <ScheduleGraph />
        <MeterDailyGraph />
        <UsageCostGraph />
        <UnitRateDailyGraph />
      </DateRangeProvider>
    </>
  );
}
