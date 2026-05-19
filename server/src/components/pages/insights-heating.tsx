import React, { useMemo } from 'react';
import { Anchor, Badge, Box, Group, Table, Text, Title } from '@mantine/core';
import { useDevices } from '../../hooks/queries/use-devices';
import { useHeatingInsights } from '../../hooks/queries/use-heating-insights';
import { DateRangeProvider, DateRangeSelector, useDateRange } from '../date-range';
import { CapabilityGraph } from '../capability-graphs/capability-graph';
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
            <Table.Td>{cap.targetTemperature.value === null ? '—' : `${cap.targetTemperature.value}°`}</Table.Td>
            <Table.Td>{cap.currentTemperature.value === null ? '—' : `${cap.currentTemperature.value}°`}</Table.Td>
            <Table.Td>{cap.power.value === null ? '—' : `${cap.power.value}%`}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function HeatPumpLink() {
  const { data, isLoading } = useDevices();

  if (isLoading || !data) {
    return null;
  }

  return (
    <Group gap="xs" mt="md">
      <Text size="sm" c="dimmed">Heat pump:</Text>
      {forDeviceCapability(data.devices, 'HEAT_PUMP', (device) => (
        <Anchor key={device.id} component={Link} to={`/device/${device.id}`}>
          {device.name}
        </Anchor>
      ))}
    </Group>
  );
}

const yAxisPercentage = {
  yPercentage: {
    position: 'left' as const,
    min: 0,
    max: 100
  }
};

const yAxisDelta = {
  yDelta: {
    position: 'left' as const
  }
};

function HeatingDemandGraph() {
  const { globalRange } = useDateRange();

  const params = useMemo(() => ({
    since: globalRange.since.toISOString(),
    until: globalRange.until.toISOString()
  }), [globalRange.since, globalRange.until]);

  const { data, isPending, isError } = useHeatingInsights(params);

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

      <Title order={4} mt="lg">Temperature delta (current − target)</Title>
      <CapabilityGraph
        lines={data.temperatureDeltas}
        yAxis={yAxisDelta}
        zones={
          data.temperatureDeltaSwitchOnThreshold !== null
            ? [{ max: -data.temperatureDeltaSwitchOnThreshold, color: 'rgba(255, 0, 55, 0.15)' }]
            : []
        }
      />
    </>
  );
}

export default function HeatingInsights() {
  return (
    <>
      <Title order={2}>Heating</Title>

      <ThermostatTable />
      <HeatPumpLink />

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
