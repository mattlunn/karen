import React, { ReactNode, useState } from 'react';
import { ActionIcon, Group, Modal, Paper, Text } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from '../dayjs';
import { humanDate } from '../helpers/date';
import type { IconClickContext } from './capabilities';
import { getMetricIconColor, getMetricButtonBackgroundColor } from './capabilities';
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

type StatusItemProps = {
  icon: IconDefinition;
  title: string;
  value: ReactNode;
  iconColor?: string;
  iconHighlighted?: boolean;
  isIssue?: boolean;
  onIconClick?: (ctx: IconClickContext) => void | Promise<void>;
} & (
  | { since: string; lastReported: string }
  | { footer?: string }
);

export function StatusItem(props: StatusItemProps) {
  const { icon, title, value, onIconClick } = props;
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

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text size="xs" c="dimmed" className={styles.title}>
          {title}
        </Text>
        {isClickable ? (
          <ActionIcon
            variant="filled"
            radius="xl"
            size="xl"
            onClick={handleIconClick}
            loading={isPending}
            aria-label={title}
            style={{ backgroundColor: getMetricButtonBackgroundColor(props), borderColor: 'transparent' }}
          >
            <FontAwesomeIcon icon={icon} color="white" className={styles.icon} />
          </ActionIcon>
        ) : (
          <FontAwesomeIcon icon={icon} color={getMetricIconColor(props)} className={styles.icon} />
        )}
      </Group>

      <Group align="flex-end" gap="xs" mt={typeof value === 'string' ? 20 : 0}>
        <Text className={styles.value}>{value}</Text>
      </Group>

      <Text fz="xs" c="dimmed" mt={7}>
        {'since' in props ? formatTimestamp(props.since, props.lastReported) : props.footer}
      </Text>

      <Modal opened={!!modalContent} onClose={() => setModalContent(null)} size="md" centered>
        {modalContent}
      </Modal>
    </Paper>
  );
}
