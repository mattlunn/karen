import React, { useMemo, useState } from 'react';
import { YearView } from '@mantine/schedule';
import type { ScheduleEventData } from '@mantine/schedule';
import type { CapabilityApiResponse } from '../api/types';
import dayjs from '../dayjs';

type BinCollectionCapability = Extract<CapabilityApiResponse, { type: 'BIN_COLLECTION' }>;

interface BinScheduleCalendarProps {
  bins: Array<{ name: string; capability: BinCollectionCapability }>;
}

export default function BinScheduleCalendar({ bins }: BinScheduleCalendarProps) {
  const [date, setDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  const events: ScheduleEventData[] = useMemo(() => {
    const result: ScheduleEventData[] = [];

    const colorMap: Record<string, string> = {
      blue: '#4dabf7',
      black: '#495057',
      green: '#51cf66',
      brown: '#a0522d',
    };

    for (const bin of bins) {
      const cap = bin.capability;
      const color = colorMap[cap.color] ?? '#868e96';

      // Main recurring series
      result.push({
        id: `${bin.name}-series`,
        title: bin.name,
        start: dayjs().startOf('year').format('YYYY-MM-DD HH:mm:ss'),
        end: dayjs().startOf('year').add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
        color,
        recurrence: {
          rrule: cap.rrule,
          exdate: cap.exdates.map(d => `${d} 00:00:00`),
        },
      });

      // Override events as one-off events
      for (const override of cap.overrides) {
        result.push({
          id: `${bin.name}-override-${override.newDate}`,
          title: `${bin.name} (rescheduled)`,
          start: `${override.newDate} 00:00:00`,
          end: `${override.newDate} 01:00:00`,
          color,
        });
      }
    }

    return result;
  }, [bins]);

  return (
    <YearView
      date={date}
      onDateChange={setDate}
      events={events}
      mode="static"
    />
  );
}
