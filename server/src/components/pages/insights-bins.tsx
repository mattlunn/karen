import React, { useMemo } from 'react';
import { Title, Stack, Group, Text, Paper, Box } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import useApiCall from '../../hooks/api';
import type { DevicesApiResponse, CapabilityApiResponse } from '../../api/types';
import PageLoader from '../page-loader';
import BinScheduleCalendar from '../bin-schedule-calendar';
import dayjs from '../../dayjs';

type BinCollectionCapability = Extract<CapabilityApiResponse, { type: 'BIN_COLLECTION' }>;

const colorMap: Record<string, string> = {
  blue: '#4dabf7',
  black: '#495057',
  green: '#51cf66',
  brown: '#a0522d',
};

export default function InsightsBins() {
  const { data, loading } = useApiCall<DevicesApiResponse>('/devices');

  const bins = useMemo(() => {
    if (!data) return [];

    return data.devices
      .map(device => {
        const cap = device.capabilities.find(
          (c): c is BinCollectionCapability => c.type === 'BIN_COLLECTION'
        );
        return cap ? { name: device.name, capability: cap } : null;
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }, [data]);

  const upcomingByDate = useMemo(() => {
    const groups = new Map<string, string[]>();

    for (const bin of bins) {
      if (bin.capability.nextCollection) {
        const dateStr = dayjs(bin.capability.nextCollection.date).format('YYYY-MM-DD');

        if (!groups.has(dateStr)) {
          groups.set(dateStr, []);
        }
        groups.get(dateStr)!.push(bin.name);
      }
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, names]) => ({ date: dayjs(date), names }));
  }, [bins]);

  if (loading || !data) {
    return <PageLoader />;
  }

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

      <Box mt="md">
        <BinScheduleCalendar bins={bins} />
      </Box>

      {upcomingByDate.length > 0 && (
        <Box mt="xl">
          <Title order={3} mb="md">Upcoming Collections</Title>
          <Stack gap="xs">
            {upcomingByDate.map(({ date, names }) => (
              <Paper key={date.format('YYYY-MM-DD')} withBorder p="sm" radius="md">
                <Group gap="sm">
                  <FontAwesomeIcon icon={faTrashCan} style={{ color: '#868e96' }} />
                  <Text fw={500}>{date.format('ddd D MMM')}</Text>
                  <Text c="dimmed">{names.join(', ')}</Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}
    </>
  );
}
