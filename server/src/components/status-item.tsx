import React, { ReactNode, useState } from 'react';
import { Group, Modal, Paper, Text } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition, faSync } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from '../dayjs';
import { humanDate } from '../helpers/date';
import type { IconClickContext } from './capabilities';
import styles from './status-item.module.css';

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
  value: ReactNode;
  since: string;
  lastReported: string;
  iconColor?: string;
  onIconClick?: (ctx: IconClickContext) => void | Promise<void>;
}

export function StatusItem({ icon, title, value, since, lastReported, iconColor, onIconClick }: StatusItemProps) {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [modalContent, setModalContent] = useState<ReactNode>(null);

  const handleIconClick = async () => {
    if (isPending || !onIconClick) return;

    const ctx: IconClickContext = {
      openModal: (content) => setModalContent(content),
      closeModal: () => setModalContent(null),
      queryClient,
    };

    const result = onIconClick(ctx);
    if (result instanceof Promise) {
      setIsPending(true);
      try {
        await result;
      } finally {
        setIsPending(false);
      }
    }
  };

  const isClickable = !!onIconClick;
  const displayIcon = isPending ? faSync : icon;

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between">
        <Text size="xs" c="dimmed" className={styles.title}>
          {title}
        </Text>
        <FontAwesomeIcon
          icon={displayIcon}
          spin={isPending}
          color={iconColor || 'light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-3))'}
          className={`${styles.icon} ${isClickable ? styles.iconClickable : ''}`}
          onClick={isClickable ? handleIconClick : undefined}
          style={isClickable ? { cursor: 'pointer' } : undefined}
        />
      </Group>

      <Group align="flex-end" gap="xs" mt={typeof value === 'string' ? 25 : 0}>
        <Text className={styles.value}>{value}</Text>
      </Group>

      <Text fz="xs" c="dimmed" mt={7}>
        {formatTimestamp(since, lastReported)}
      </Text>

      <Modal opened={!!modalContent} onClose={() => setModalContent(null)} size="md" centered>
        {modalContent}
      </Modal>
    </Paper>
  );
}
