import React, { useMemo } from 'react';
import { Box, Table, Title } from '@mantine/core';
import useApiCall from '../../hooks/api';
import { useDevices } from '../../hooks/queries/use-devices';
import { DateRangeProvider, DateRangeSelector, useDateRange } from '../date-range';
import { CapabilityGraph } from '../capability-graphs/capability-graph';
import { HeatingInsightsApiResponse, RestDeviceResponse } from '../../api/types';
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

const yAxisPercentage = {
  yPercentage: {
    position: 'left' as const,
    min: 0,
    max: 100
  }
};

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

  if (!data) {
    return null;
  }

  return (
    <>
      <CapabilityGraph
        lines={[]}
        modes={data.modes}
        height="120px"
        yAxis={yAxisPercentage}
      />
      <CapabilityGraph
        lines={data.lines}
        yAxis={yAxisPercentage}
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
