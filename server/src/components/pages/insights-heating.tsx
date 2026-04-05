import React, { useMemo } from 'react';
import { Box, Table, Title } from '@mantine/core';
import { Chart } from 'react-chartjs-2';
import useApiCall from '../../hooks/api';
import { useDevices } from '../../hooks/queries/use-devices';
import { DateRangeProvider, DateRangeSelector, useDateRange } from '../date-range';
import { CapabilityGraph, inferTimeUnit } from '../capability-graphs/capability-graph';
import { HeatingInsightsApiResponse, RestDeviceResponse } from '../../api/types';
import { clampAndSortHistory } from '../../helpers/history';
import PageLoader from '../page-loader';

function getThermostatDevices(devices: RestDeviceResponse[]) {
  return devices.filter(d => d.capabilities.some(c => c.type === 'THERMOSTAT'));
}

function ThermostatTable() {
  const { data, isLoading } = useDevices();

  if (isLoading || !data) {
    return <PageLoader />;
  }

  const thermostats = getThermostatDevices(data.devices);

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>Target</Table.Th>
          <Table.Th>Current</Table.Th>
          <Table.Th>Power</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {thermostats.map(device => {
          const cap = device.capabilities.find(c => c.type === 'THERMOSTAT');

          if (cap?.type !== 'THERMOSTAT') {
            return null;
          }

          return (
            <Table.Tr key={device.id}>
              <Table.Td>{device.name}</Table.Td>
              <Table.Td>{cap.targetTemperature.value}°</Table.Td>
              <Table.Td>{cap.currentTemperature.value}°</Table.Td>
              <Table.Td>{cap.power.value}%</Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

function HeatingDemandGraph() {
  const { globalRange } = useDateRange();

  const params = useMemo(() => ({
    since: globalRange.since.toISOString(),
    until: globalRange.until.toISOString()
  }), [globalRange.since, globalRange.until]);

  const { data, loading, error } = useApiCall<HeatingInsightsApiResponse>(
    '/insights/heating',
    params
  );

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return <Box style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading data</Box>;
  }

  if (!data || data.lines.length === 0) {
    return null;
  }

  const min = data.lines[0].data.since;
  const max = data.lines[0].data.until;
  const timeUnit = inferTimeUnit(min, max);
  const tickStepSize = timeUnit === 'day' ? 1 : 15;

  const sortedModeEvents = clampAndSortHistory(data.modes.data.history, data.modes.data.since, data.modes.data.until, true);

  const modeDatasets: any[] = [{
    type: 'line' as const,
    data: [],
    yAxisID: 'yPercentage',
    label: '',
    pointRadius: 0,
    borderWidth: 0,
    showLine: false
  }];

  modeDatasets.push(...data.modes.details.map((mode, i) => ({
    type: 'line' as const,
    fill: 'start' as const,
    data: sortedModeEvents.reduce((acc: { x: string; y: number }[], curr) => {
      if (curr.value === mode.value) {
        acc.push(
          { x: curr.start, y: 0 },
          { x: curr.start, y: 1 },
          { x: curr.end!, y: 1 },
          { x: curr.end!, y: 0 }
        );
      }
      return acc;
    }, []),
    label: mode.label,
    yAxisID: `yMode${i}`,
    pointRadius: 0,
    borderWidth: 1,
    stepped: true as const,
    backgroundColor: mode.fillColor
  })));

  const modeScales: Record<string, any> = {
    x: {
      type: 'time',
      time: { unit: timeUnit },
      ticks: { source: 'auto', stepSize: tickStepSize },
      min,
      max
    },
    yPercentage: {
      type: 'linear',
      position: 'left',
      min: 0,
      max: 100,
      ticks: { display: false },
      grid: { display: false }
    }
  };

  data.modes.details.forEach((_, i) => {
    modeScales[`yMode${i}`] = {
      type: 'linear',
      min: 0,
      max: 1,
      display: false
    };
  });

  return (
    <>
      <Box style={{ height: '120px', position: 'relative' }}>
        <Chart
          type="line"
          data={{ datasets: modeDatasets }}
          options={{
            scales: modeScales,
            plugins: {
              colors: { forceOverride: true },
              legend: {
                display: true,
                labels: {
                  filter: (item: any) => item.text !== ''
                }
              }
            },
            maintainAspectRatio: false
          } as any}
        />
      </Box>
      <CapabilityGraph
        lines={data.lines}
        yAxis={{
          yPercentage: {
            position: 'left',
            min: 0,
            max: 100
          }
        }}
      />
    </>
  );
}

export default function HeatingInsights() {
  return (
    <>
      <Title order={2}>Heating</Title>

      <ThermostatTable />

      <DateRangeProvider>
        <Box mt="md">
          <DateRangeSelector />
        </Box>

        <Title order={4} mt="lg">Heating Demand</Title>
        <HeatingDemandGraph />
      </DateRangeProvider>
    </>
  );
}
