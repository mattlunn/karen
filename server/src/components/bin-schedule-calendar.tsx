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

    for (const bin of bins) {
      const cap = bin.capability;
      const color = cap.color;

      // Extract DTSTART from rrule so the library uses the correct anchor date.
      // Use UTC midnight (T00:00:00Z) so RRule generates occurrences at midnight UTC —
      // consistent across DST boundaries. Exdates must also use UTC midnight so the
      // recurrenceId comparison in expand-recurring-events works year-round.
      const dtstartMatch = cap.rrule.match(/DTSTART:(\d{4})(\d{2})(\d{2})/);
      const dtstart = dtstartMatch ? `${dtstartMatch[1]}-${dtstartMatch[2]}-${dtstartMatch[3]}T00:00:00Z` : undefined;

      // Main recurring series
      result.push({
        id: `${bin.name}-series`,
        title: bin.name,
        start: dayjs().startOf('year').format('YYYY-MM-DD HH:mm:ss'),
        end: dayjs().startOf('year').add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
        color,
        recurrence: {
          rrule: cap.rrule,
          dtstart,
          exdate: cap.exdates.map(d => `${d}T00:00:00Z`),
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
      styles={{
        yearViewDayIndicator: { width: 12, height: 12, borderRadius: 4 },
        yearViewDayIndicators: { gap: 2 },
      }}
    />
  );
}
