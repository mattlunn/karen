import React, { useState, useMemo, ReactNode } from 'react';
import { Checkbox, Group } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faPersonWalking, faFireBurner } from '@fortawesome/free-solid-svg-icons';
import useApiCall from '../../hooks/api';
import { useDateRange } from '../date-range';
import dayjs, { Dayjs } from '../../dayjs';
import { DateRange } from '../date-range/types';
import Event from '../event';

// Response type from /api/device/:id/timeline endpoint
type TimelineEventResponse = {
  type: 'light-on' | 'light-off' | 'motion-start' | 'motion-end' | 'heatpump-mode';
  timestamp: string;
  value?: string;
};

type TimelineApiResponse = {
  since: string;
  until: string;
  events: TimelineEventResponse[];
};

type TimelineSectionProps = {
  deviceId: number;
};

type TimelineItem = {
  timestamp: Date;
  component: ReactNode;
};

function renderTimeline(events: TimelineItem[]): ReactNode {
  const days: { date: Dayjs; events: ReactNode[] }[] = [];

  events.toSorted((a, b) => {
    return a.timestamp.getTime() - b.timestamp.getTime();
  }).forEach((event) => {
    const eventDayjs = dayjs(event.timestamp);
    const isSameDay = days.length > 0 && days[0].date.isSame(eventDayjs, 'day');

    if (isSameDay) {
      days[0].events.unshift(event.component);
    } else {
      days.unshift({
        date: eventDayjs.startOf('day'),
        events: [event.component]
      });
    }
  });

  return (
    <ol className='timeline'>
      {days.map(({ date, events }, idx) => {
        return (
          <li key={idx} className='day'>
            <h4 className='day__header'>{date.format('dddd, MMMM Do YYYY')}</h4>

            <ol className='events'>
              {events.map((event, idx) => {
                return (
                  <li className='event' key={idx}>
                    {event}
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}

function mapEventToComponent(event: TimelineEventResponse): ReactNode {
  switch (event.type) {
    case 'light-on':
      return <Event icon={faLightbulb} title="Light turned on" timestamp={event.timestamp} iconColor='#ffa24d' />;
    case 'light-off':
      return <Event icon={faLightbulb} title="Light turned off" timestamp={event.timestamp} />;
    case 'motion-start':
      return <Event icon={faPersonWalking} title="Motion detected" timestamp={event.timestamp} />;
    case 'motion-end':
      return <Event icon={faPersonWalking} title="Motion ended" timestamp={event.timestamp} />;
    case 'heatpump-mode':
      return <Event icon={faFireBurner} title={`Mode changed to ${event.value}`} timestamp={event.timestamp} />;
    default:
      return null;
  }
}

export function TimelineSection({ deviceId }: TimelineSectionProps) {
  const { globalRange } = useDateRange();
  const [usePageRange, setUsePageRange] = useState(true);
  const [localRange, setLocalRange] = useState<DateRange | null>(null);

  const effectiveRange = usePageRange ? globalRange : (localRange ?? globalRange);

  const params = useMemo(() => ({
    since: effectiveRange.since.toISOString(),
    until: effectiveRange.until.toISOString()
  }), [effectiveRange.since.valueOf(), effectiveRange.until.valueOf()]);

  const { data, loading, error } = useApiCall<TimelineApiResponse>(
    `/device/${deviceId}/timeline`,
    params
  );

  const handleUsePageRangeChange = (checked: boolean) => {
    if (!checked && !localRange) {
      setLocalRange(globalRange);
    }
    setUsePageRange(checked);
  };

  if (loading) {
    return <div>Loading timeline...</div>;
  }

  if (error) {
    return <div>Error loading timeline</div>;
  }

  if (!data) {
    return null;
  }

  const timelineItems: TimelineItem[] = data.events.map(event => ({
    timestamp: new Date(event.timestamp),
    component: mapEventToComponent(event)
  }));

  return (
    <div className="timeline-section">
      <div className="timeline-section__controls">
        <Checkbox
          label="Use page date range"
          checked={usePageRange}
          onChange={(e) => handleUsePageRangeChange(e.currentTarget.checked)}
        />

        {!usePageRange && localRange && (
          <Group mt="xs">
            <DateTimePicker
              label="From"
              size="xs"
              value={localRange.since.toDate()}
              onChange={(date) => date && setLocalRange({
                ...localRange,
                since: dayjs(date)
              })}
              maxDate={localRange.until.toDate()}
            />
            <DateTimePicker
              label="To"
              size="xs"
              value={localRange.until.toDate()}
              onChange={(date) => date && setLocalRange({
                ...localRange,
                until: dayjs(date)
              })}
              minDate={localRange.since.toDate()}
              maxDate={new Date()}
            />
          </Group>
        )}
      </div>

      {timelineItems.length > 0 ? renderTimeline(timelineItems) : <p>No events in this time range</p>}
    </div>
  );
}
