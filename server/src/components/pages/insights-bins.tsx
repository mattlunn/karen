import React from 'react';
import { Anchor, Title, Text, Box, Table, Group } from '@mantine/core';
import useApiCall from '../../hooks/api';
import type { DevicesApiResponse } from '../../api/types';
import PageLoader from '../page-loader';
import BinScheduleCalendar from '../bin-schedule-calendar';
import dayjs from '../../dayjs';
import { forDeviceCapability } from '../../helpers/device';
import { Link } from 'react-router-dom';

export default function InsightsBins() {
  const { data, loading } = useApiCall<DevicesApiResponse>('/devices');

  if (loading || !data) {
    return <PageLoader />;
  }

  const bins = forDeviceCapability(data.devices, 'BIN_COLLECTION', (device, capability) => ({
    id: device.id,
    name: device.name,
    capability,
  }));

  if (bins.length === 0) {
    return (
      <>
        <Title order={2}>Bin Collections</Title>
        <Text mt="md">No bin collection devices configured.</Text>
      </>
    );
  }

  return (
    <>
      <Title order={2}>Bin Collections</Title>

      <Table mt="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Next Collection</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {bins.map(({ id, name, capability: cap }) => {
            const next = dayjs(cap.nextCollection.date);
            const isOverride = cap.nextCollection.isOverride;
            const originalDate = isOverride
              ? cap.overrides.find(o => o.newDate === next.format('YYYY-MM-DD'))!.originalDate
              : null;

            return (
              <Table.Tr key={id}>
                <Table.Td>
                  <Anchor component={Link} to={`/device/${id}`}>{name}</Anchor>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {isOverride && (
                      <Text component="span" td="line-through" c="dimmed">
                        {dayjs(originalDate!).format('ddd D MMM')}
                      </Text>
                    )}
                    <Text component="span">{next.format('ddd D MMM')}</Text>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      <Box mt="xl">
        <BinScheduleCalendar bins={bins} />
      </Box>
    </>
  );
}
