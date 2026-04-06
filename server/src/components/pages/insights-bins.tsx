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
    const today = dayjs().startOf('day');
    const windowEnd = today.add(4, 'week');

    for (const bin of bins) {
      const cap = bin.capability;
      const intervalMatch = cap.rrule.match(/INTERVAL=(\d+)/);
      const dtstartMatch = cap.rrule.match(/DTSTART:(\d{4})(\d{2})(\d{2})/);

      if (!intervalMatch || !dtstartMatch) continue;

      const interval = Number(intervalMatch[1]);
      const anchor = dayjs(`${dtstartMatch[1]}-${dtstartMatch[2]}-${dtstartMatch[3]}`);
      const periodDays = interval * 7;
      const exdateSet = new Set(cap.exdates);
      const overrideMap = new Map(cap.overrides.map(o => [o.originalDate, o.newDate]));

      // Find the first occurrence on or after today
      const diffDays = today.diff(anchor, 'day');
      const periodsPassed = diffDays > 0 ? Math.floor(diffDays / periodDays) : 0;
      let candidate = anchor.add(periodsPassed * periodDays, 'day');

      if (candidate.isBefore(today, 'day')) {
        candidate = candidate.add(periodDays, 'day');
      }

      // Generate occurrences within the window
      while (candidate.isBefore(windowEnd, 'day')) {
        const dateStr = candidate.format('YYYY-MM-DD');

        if (exdateSet.has(dateStr)) {
          // Original date is excluded — use the override's new date instead
          const newDate = overrideMap.get(dateStr);

          if (newDate && dayjs(newDate).isBefore(windowEnd, 'day')) {
            if (!groups.has(newDate)) groups.set(newDate, []);
            groups.get(newDate)!.push(bin.name);
          }
        } else {
          if (!groups.has(dateStr)) groups.set(dateStr, []);
          groups.get(dateStr)!.push(bin.name);
        }

        candidate = candidate.add(periodDays, 'day');
      }
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
