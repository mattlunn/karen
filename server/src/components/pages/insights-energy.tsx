import React from 'react';
import { Anchor, Box, Table, Title } from '@mantine/core';
import { Link } from 'react-router';
import type { EnergyPeriodTotalsApiResponse } from '../../api/types';
import { formatValueOrUnknown as v } from '../../helpers/format';
import { useEnergyDeviceSummaryInsights, useEnergyDeviceCostDailyInsights, useEnergyDeviceUnitRateDailyInsights, useEnergyDeviceEnergyDailyInsights, useEnergyPowerInsights } from '../../hooks/queries/use-energy-insights';
import { useDevices } from '../../hooks/queries/use-devices';
import { DateRangeProvider, DateRangeSelector } from '../date-range';
import { CapabilityGraph } from '../capability-graphs/capability-graph';
import { GraphSection } from '../capability-graphs/graph-section';
import { GraphChrome } from '../graph-chrome';
import { getDeviceGraphSection } from '../capabilities';
import PageLoader from '../page-loader';
import dayjs from '../../dayjs';

// Keyed 'y' (CapabilityGraph's default yAxisID) rather than a bespoke id, so
// lines/bars can omit yAxisID entirely. Left blank to pick up CapabilityGraph's
// own position/suggestedMin defaults.
const yAxisLeft = { y: {} };

function GraphState({ isPending, isError, children }: { isPending: boolean; isError: boolean; children: React.ReactNode }) {
  if (isPending) {
    return <PageLoader />;
  }

  if (isError) {
    return <Box style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading data</Box>;
  }

  return <>{children}</>;
}

function PeriodCells({ totals }: { totals: EnergyPeriodTotalsApiResponse }) {
  return (
    <>
      <Table.Td ta="right">{v(totals.unitRate, (rate) => `${rate.toFixed(1)}p`)}</Table.Td>
      <Table.Td ta="right">{totals.energyKwh.toFixed(1)} kWh</Table.Td>
      <Table.Td ta="right">£{(totals.costPence / 100).toFixed(2)}</Table.Td>
    </>
  );
}

function PeriodHeading({ children }: { children: React.ReactNode }) {
  return (
    <Table.Th colSpan={3} ta="center">
      <Box pb={4} style={{ borderBottom: '1px solid var(--table-border-color)' }}>{children}</Box>
    </Table.Th>
  );
}

function DeviceSummaryTable() {
  const { data, isPending, isError } = useEnergyDeviceSummaryInsights();

  return (
    <GraphState isPending={isPending} isError={isError}>
      {data && (
        <Table.ScrollContainer minWidth={640} mt="md">
          <Table striped>
            <Table.Thead>
              {/* Each PeriodHeading underlines itself, so the underlines break between the groups. */}
              <Table.Tr style={{ borderBottom: 'none' }}>
                <Table.Th rowSpan={2}>Device</Table.Th>
                <PeriodHeading>This tariff (since {dayjs(data.thisTariffSince).format('D MMM YYYY')})</PeriodHeading>
                <PeriodHeading>Last month</PeriodHeading>
              </Table.Tr>
              <Table.Tr>
                {['p/kWh', 'Usage', 'Cost', 'p/kWh', 'Usage', 'Cost'].map((heading, i) => (
                  <Table.Th key={i} ta="right">{heading}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.rows.map(({ label, deviceId, role, thisTariff, lastMonth }) => (
                <Table.Tr key={label} fw={role === 'total' ? 700 : undefined} c={role === 'residual' ? 'dimmed' : undefined}>
                  <Table.Td>
                    {deviceId === null ? label : <Anchor component={Link} to={`/device/${deviceId}`} inherit>{label}</Anchor>}
                  </Table.Td>
                  <PeriodCells totals={thisTariff} />
                  <PeriodCells totals={lastMonth} />
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </GraphState>
  );
}

function UsageGraph() {
  return (
    <GraphChrome title="Usage (W)" localPreset="last6hours">
      {({ since, until }) => <UsageGraphBody since={since} until={until} />}
    </GraphChrome>
  );
}

function UsageGraphBody({ since, until }: { since: string; until: string }) {
  const { data, isPending, isError } = useEnergyPowerInsights({ since, until });

  return (
    <GraphState isPending={isPending} isError={isError}>
      {data && (
        <CapabilityGraph
          lines={data.series}
          yAxis={{ ...yAxisLeft, yRate: { position: 'right', suggestedMax: data.wholeDaysMaxUnitRate ?? undefined } }}
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
  const { data, isPending, isError } = useEnergyDeviceEnergyDailyInsights({ since, until });

  return (
    <GraphState isPending={isPending} isError={isError}>
      {data && (
        <CapabilityGraph
          lines={[]}
          bars={data.series.map(series => ({ data: series.data, label: series.label, period: 'day' as const, hatched: series.role === 'residual' }))}
          stacked
          timeUnit="day"
          yAxis={yAxisLeft}
        />
      )}
    </GraphState>
  );
}

function CostGraphBody({ since, until }: { since: string; until: string }) {
  const { data, isPending, isError } = useEnergyDeviceCostDailyInsights({ since, until });

  return (
    <GraphState isPending={isPending} isError={isError}>
      {data && (
        <CapabilityGraph
          lines={[]}
          bars={data.series.map(series => ({ data: series.data, label: series.label, period: 'day' as const, hatched: series.role === 'residual' }))}
          stacked
          timeUnit="day"
          yAxis={yAxisLeft}
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
  const { data, isPending, isError } = useEnergyDeviceUnitRateDailyInsights({ since, until });

  return (
    <GraphState isPending={isPending} isError={isError}>
      {data && (
        <CapabilityGraph
          lines={data.lines}
          timeUnit="day"
          yAxis={yAxisLeft}
        />
      )}
    </GraphState>
  );
}

export default function EnergyInsights() {
  return (
    <>
      <Title order={2}>Energy</Title>

      <DeviceSummaryTable />

      <DateRangeProvider defaultPreset="lastMonth">
        <Box mt="md">
          <DateRangeSelector />
        </Box>

        <UsageGraph />
        <MeterDailyGraph />
        <UsageCostGraph />
        <UnitRateDailyGraph />
      </DateRangeProvider>
    </>
  );
}
