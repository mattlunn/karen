import React, { useState, useMemo } from 'react';
import { Checkbox, Group, Title } from '@mantine/core';
import { faLightbulb, faPersonWalking, faFireBurner, faHandPointer, faSignal, faDoorOpen, faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons';
import { useDeviceTimeline } from '../hooks/queries/use-device-timeline';
import { useDateRange, DateRangeSelector } from './date-range';
import { DateRange, DateRangePreset } from './date-range/types';
import Timeline, { TimelineItem } from './timeline/timeline';
import { DeviceTimelineEventApiResponse } from '../api/types';
import { formatDuration } from '../helpers/date';

type DeviceTimelineProps = {
  deviceId: number;
};

function mapEventToTimelineItem(event: DeviceTimelineEventApiResponse): TimelineItem | null {
  switch (event.type) {
    case 'light-on':
      return { icon: faLightbulb, title: 'Light turned on', timestamp: event.timestamp, iconColor: '#ffa24d' };
    case 'light-off':
      return { icon: faLightbulb, title: 'Light turned off', timestamp: event.timestamp };
    case 'motion-start':
      return { icon: faPersonWalking, title: event.instanceName ? `Motion detected (${event.instanceName})` : 'Motion detected', timestamp: event.timestamp };
    case 'motion-end':
      return { icon: faPersonWalking, title: event.instanceName ? `Motion ended (${event.instanceName})` : 'Motion ended', timestamp: event.timestamp };
    case 'heatpump-mode':
      return { icon: faFireBurner, title: `Mode changed to ${event.value}`, timestamp: event.timestamp };
    case 'button-press':
      return { icon: faHandPointer, title: 'Button pressed', timestamp: event.timestamp };
    case 'connectivity-online':
      return { icon: faSignal, title: 'Device came online', timestamp: event.timestamp, iconColor: '#33aa33' };
    case 'connectivity-offline':
      return { icon: faSignal, title: 'Device went offline', timestamp: event.timestamp, iconColor: '#cc3333' };
    case 'contact-opened':
      return {
        icon: faDoorOpen,
        title: event.durationSeconds === null
          ? 'Opened'
          : `Opened for ${formatDuration(event.durationSeconds)}`,
        timestamp: event.timestamp,
        iconColor: '#04A7F4',
      };
    case 'switch-on':
      return { icon: faToggleOn, title: 'Turned on', timestamp: event.timestamp, iconColor: '#04A7F4' };
    case 'switch-off':
      return { icon: faToggleOff, title: `Turned off after ${formatDuration(event.durationSeconds)}`, timestamp: event.timestamp };
  }

  return null;
}

export function DeviceTimeline({ deviceId }: DeviceTimelineProps) {
  const { globalRange } = useDateRange();
  const [usePageRange, setUsePageRange] = useState(true);
  const [localPreset, setLocalPreset] = useState<DateRangePreset>('last6hours');
  const [localRange, setLocalRange] = useState<DateRange | null>(null);

  const effectiveRange = usePageRange ? globalRange : (localRange ?? globalRange);

  const params = useMemo(() => ({
    since: effectiveRange.since.toISOString(),
    until: effectiveRange.until.toISOString()
  }), [effectiveRange.since, effectiveRange.until]);

  const { data, isPending, isError } = useDeviceTimeline(deviceId, params);

  const handleUsePageRangeChange = (checked: boolean) => {
    if (!checked && !localRange) {
      setLocalRange(globalRange);
    }
    setUsePageRange(checked);
  };

  if (isPending) {
    return <div>Loading timeline...</div>;
  }

  if (isError) {
    return <div>Error loading timeline</div>;
  }

  if (!data) {
    return null;
  }

  const timelineItems: TimelineItem[] = data.events.flatMap(event => {
    const item = mapEventToTimelineItem(event);
    return item ? [item] : [];
  });

  return (
    <div className="timeline-section">
      <Group justify="space-between" className="device-graph__controls" mt="lg">
        <Title order={3}>Timeline</Title>
        <Group justify="flex-end" className="timeline-section__controls">
          {!usePageRange && localRange && (
            <DateRangeSelector
              preset={localPreset}
              range={localRange}
              onPresetChange={setLocalPreset}
              onRangeChange={setLocalRange}
            />
          )}

          <Checkbox
            label="Use page date range"
            checked={usePageRange}
            onChange={(e) => handleUsePageRangeChange(e.currentTarget.checked)}
          />
        </Group>
      </Group>

      {timelineItems.length > 0
        ? <Timeline items={timelineItems} dayHeaderOrder={4} />
        : <p>No events in this time range</p>}
    </div>
  );
}
