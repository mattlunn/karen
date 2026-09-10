import React, { useEffect, useMemo, useState } from 'react';
import { Box, Group, Title } from '@mantine/core';
import { useEnergyCostInsights, useEnergyScheduleInsights, useEnergyUnitRateDailyInsights, useEnergyUsageInsights } from '../../hooks/queries/use-energy-insights';
import { useDevices } from '../../hooks/queries/use-devices';
import { useDeviceHistory } from '../../hooks/queries/use-device-history';
import { DateRangeProvider, DateRangeSelector, getPresetRange } from '../date-range';
import { DateRange, DateRangePreset } from '../date-range/types';
import { CapabilityGraph } from '../capability-graphs/capability-graph';
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

const yAxisRate = {
  yRate: {
    position: 'left' as const,
    suggestedMin: 0
  }
};

const yAxisMeterDaily = {
  yEnergy: {
    position: 'left' as const,
    min: 0,
    label: 'Energy (kWh)',
    display: 'auto' as const
  },
  yCost: {
    position: 'right' as const,
    min: 0,
    label: 'Cost (£)',
    display: 'auto' as const
  },
  yRate: {
    position: 'right' as const,
    suggestedMin: 0,
    label: 'Unit rate (p/kWh)',
    display: 'auto' as const
  }
};

function useLocalRange(defaultPreset: DateRangePreset, initialRange?: DateRange) {
  const [preset, setPreset] = useState<DateRangePreset>(defaultPreset);
  const [range, setRange] = useState<DateRange>(() => initialRange ?? getPresetRange(defaultPreset));

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

// The whole-house total is just the smart meter's own per-device daily graph -
// the ENERGY_MONITOR device that also reports ENERGY_COST - so this renders
// /device/<meter>/history?id=energy-daily rather than a bespoke endpoint.
function MeterDailyGraph() {
  const { preset, setPreset, range, setRange, params } = useLocalRange('lastMonth');
  const { data: devicesData } = useDevices();

  const meterId = devicesData?.devices.find(device =>
    device.capabilities.some(c => c.type === 'ENERGY_MONITOR') &&
    device.capabilities.some(c => c.type === 'ENERGY_COST')
  )?.id;

  return (
    <>
      <Group justify="space-between" mt="lg">
        <Title order={4}>House total (per day)</Title>
        <DateRangeSelector
          preset={preset}
          range={range}
          onPresetChange={setPreset}
          onRangeChange={setRange}
        />
      </Group>

      {meterId == null ? <PageLoader /> : <MeterDailyGraphBody deviceId={meterId} params={params} />}
    </>
  );
}

function MeterDailyGraphBody({ deviceId, params }: { deviceId: number; params: { since: string; until: string } }) {
  const historyParams = useMemo(
    () => ({ id: 'energy-daily', since: params.since, until: params.until }),
    [params.since, params.until]
  );
  const { data, isPending, isError } = useDeviceHistory(deviceId, historyParams);

  if (isPending || !data) {
    return <PageLoader />;
  }

  if (isError) {
    return <Box style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading data</Box>;
  }

  return (
    <CapabilityGraph
      lines={data.lines}
      bars={data.bars}
      timeUnit="day"
      yAxis={yAxisMeterDaily}
    />
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
          lines={[]}
          bars={data.series.map(series => ({ data: series.data, label: series.label, yAxisID: 'yCost', period: 'day' as const, hatched: series.role === 'residual' }))}
          stacked
          timeUnit="day"
          yAxis={yAxisCost}
        />
      )}
    </>
  );
}

function UnitRateDailyGraph() {
  const { preset, setPreset, range, setRange, params } = useLocalRange('lastMonth');
  const { data, isPending, isError } = useEnergyUnitRateDailyInsights(params);

  return (
    <>
      <Group justify="space-between" mt="lg">
        <Title order={4}>Effective unit rate (p/kWh per day)</Title>
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
          timeUnit="day"
          yAxis={yAxisRate}
        />
      )}
    </>
  );
}

function ScheduleGraph() {
  const { preset, setPreset, range, setRange, params } = useLocalRange('custom', {
    since: dayjs().startOf('day'),
    until: dayjs().endOf('day'),
  });
  const { data, isPending, isError } = useEnergyScheduleInsights(params);

  // The server ends the view at the last published price - reflect that in the
  // Custom range's `until` so the selector matches what's shown.
  const dataUntil = data?.lines[0]?.data.until;

  useEffect(() => {
    if (preset === 'custom' && dataUntil && dataUntil !== range.until.toISOString()) {
      setRange({ since: range.since, until: dayjs(dataUntil) });
    }
  }, [dataUntil, preset, range.since, range.until, setRange]);

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
          timeUnit="hour"
          markers={[{ at: dayjs().toISOString(), label: 'Now', color: '#fa5252' }]}
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
        <MeterDailyGraph />
        <CostGraph />
        <UnitRateDailyGraph />
      </DateRangeProvider>
    </>
  );
}
