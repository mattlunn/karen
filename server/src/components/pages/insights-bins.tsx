import React from 'react';
import { Anchor, Title, Stack, Group, Text, Paper, Box, Table } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
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

  const upcomingByDate = (() => {
    const groups = new Map<string, string[]>();

    for (const bin of bins) {
      const dateStr = dayjs(bin.capability.nextCollection.date).format('YYYY-MM-DD');

      if (!groups.has(dateStr)) {
        groups.set(dateStr, []);
      }
      groups.get(dateStr)!.push(bin.name);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, names]) => ({ date: dayjs(date), names }));
  })();

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

      {upcomingByDate.length > 0 && (
        <Box mt="xl">
          <Title order={3} mb="md">Upcoming Collections</Title>
          <Stack gap="xs">
            {upcomingByDate.map(({ date, names }) => (
              <Paper key={date.format('YYYY-MM-DD')} withBorder p="sm" radius="md">
                <Group gap="sm">
                  <FontAwesomeIcon icon={faTrash} style={{ color: '#868e96' }} />
                  <Text fw={500}>{date.format('ddd D MMM')}</Text>
                  <Text c="dimmed">{names.join(', ')}</Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      <Box mt="xl">
        <BinScheduleCalendar bins={bins} />
      </Box>
    </>
  );
}
