import React, { ReactNode } from 'react';
import { Title, TitleOrder } from '@mantine/core';
import dayjs, { Dayjs } from '../../dayjs';
import styles from './timeline.module.css';

export type TimelineItem = {
  timestamp: string;
  component: ReactNode;
};

type TimelineProps = {
  items: TimelineItem[];
  dayHeaderOrder?: TitleOrder;
};

type Day = {
  date: Dayjs;
  events: ReactNode[];
};

function groupByDay(items: TimelineItem[]): Day[] {
  const sorted = items.toSorted((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const days: Day[] = [];

  for (const item of sorted) {
    const ts = dayjs(item.timestamp);
    const last = days[days.length - 1];

    if (last && last.date.isSame(ts, 'day')) {
      last.events.push(item.component);
    } else {
      days.push({ date: ts.startOf('day'), events: [item.component] });
    }
  }

  return days;
}

export default function Timeline({ items, dayHeaderOrder = 3 }: TimelineProps) {
  const days = groupByDay(items);

  return (
    <ol className={styles.root}>
      {days.map(({ date, events }, idx) => (
        <li key={idx}>
          <Title order={dayHeaderOrder} className={styles.dayHeader}>
            {date.format('dddd, MMMM Do YYYY')}
          </Title>

          <ol>
            {events.map((event, i) => (
              <li key={i} className={styles.event}>{event}</li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
