import React, { useMemo } from 'react';
import { Anchor, Badge, Box, Table, Title } from '@mantine/core';
import useApiCall from '../../hooks/api';
import { useDevices } from '../../hooks/queries/use-devices';
import { DateRangeProvider, DateRangeSelector, useDateRange } from '../date-range';
import { CapabilityGraph } from '../capability-graphs/capability-graph';
import { HeatingInsightsApiResponse } from '../../api/types';
import PageLoader from '../page-loader';
import { Link } from 'react-router-dom';
import { forDeviceCapability } from '../../helpers/device';

function ThermostatTable() {
  const { data, isLoading } = useDevices();

  if (isLoading || !data) {
    return <PageLoader />;
  }

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
        {forDeviceCapability(data.devices, 'THERMOSTAT', (device, cap) => (
          <Table.Tr key={device.id}>
            <Table.Td>
              <Anchor component={Link} to={`/device/${device.id}`}>
                {device.name}
              </Anchor>
              {cap.isPassive.value && <Badge ml="xs" size="xs" variant="outline" color="gray">Passive</Badge>}
            </Table.Td>
            <Table.Td>{cap.targetTemperature.value}°</Table.Td>
            <Table.Td>{cap.currentTemperature.value}°</Table.Td>
            <Table.Td>{cap.power.value}%</Table.Td>
          </Table.Tr>
        ))}
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
