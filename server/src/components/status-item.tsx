import React from 'react';
import { Group, Paper, Text } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { dayjs } from '../dayjs';
import { humanDate } from '../helpers/date';

function formatTimestamp(start: string, lastReported: string): string {
  let lead = 'since';
  let date = dayjs(start);

  if (lastReported !== start) {
    lead = 'as of';
    date = dayjs(lastReported);
  }

  return `${lead} ${date.format('HH:mm')} ${humanDate(date)}`;
}

interface StatusItemProps {
  icon: IconDefinition;
  title: string;
  value: string;
  since: string;
  lastReported: string;
  color?: string;
}

export function StatusItem({ icon, title, value, since, lastReported, color }: StatusItemProps) {
  return (
    <Paper withBorder p="md" radius="md" className="status-item">
      <Group justify="space-between">
        <Text size="xs" c="dimmed" className="status-item__title">
          {title}
        </Text>
        <FontAwesomeIcon icon={icon} color={color || 'light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-3))'} className="status-item__icon" />
      </Group>

      <Group align="flex-end" gap="xs" mt={25}>
        <Text className="status-item__value">{value}</Text>
      </Group>

      <Text fz="xs" c="dimmed" mt={7}>
        {formatTimestamp(since, lastReported)}
      </Text>
    </Paper>
  );
}
