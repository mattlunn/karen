import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  Menu,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMatches,
} from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBell,
  faBellSlash,
  faDoorClosed,
  faDoorOpen,
  faPersonWalking,
  faShieldHalved,
  faSignal,
} from '@fortawesome/free-solid-svg-icons';
import { useDevices } from '../../hooks/queries/use-devices';
import { useCameraDevices } from '../../hooks/queries/use-camera-devices';
import { useSecurity } from '../../hooks/queries/use-security';
import { useAlarmMutation } from '../../hooks/mutations/use-security-mutations';
import { useSecurityInsights } from '../../hooks/queries/use-security-insights';
import { useSilencingWindows } from '../../hooks/queries/use-silencing-windows';
import { DateRangeProvider, DateRangeSelector, useDateRange } from '../date-range';
import { forDeviceCapability } from '../../helpers/device';
import { humanDate } from '../../helpers/date';
import dayjs from '../../dayjs';
import PageLoader from '../page-loader';
import Security from '../security';
import Timeline from '../timeline/timeline';
import type { TimelineItem } from '../timeline/timeline';
import type { AlarmMode, SecurityInsightsApiResponse, SilencingWindowOccurrenceApiResponse } from '../../api/types';
import styles from './insights-security.module.css';

const MODE_LABELS: Record<AlarmMode, string> = { OFF: 'Home', NIGHT: 'Night', AWAY: 'Away' };
const MODE_COLORS: Record<AlarmMode, string> = { OFF: 'green', NIGHT: 'grape', AWAY: 'red' };

// Ticks the component every intervalMs, purely so time-relative UI (e.g. "is the alarm still
// actively alerting") keeps itself up to date without requiring a full data refetch.
function useTick(intervalMs: number) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
}

// Fixed-size icon badge shared by the status card and the KPI tiles, so the "headline" icon
// reads at the same size and weight everywhere in this row, regardless of how much text sits
// next to it - previously the shield used FontAwesomeIcon's "2x" size while the KPI tiles used
// "lg", which made the row look mismatched as soon as the status card grew taller.
function KpiIcon({ icon, color }: { icon: IconDefinition; color?: string }) {
  return (
    <ThemeIcon size={40} radius="xl" variant="light" color={color ?? 'gray'}>
      <FontAwesomeIcon icon={icon} />
    </ThemeIcon>
  );
}

function StatusCard() {
  const { data: security, isPending, isError } = useSecurity();
  const { mutate: updateAlarmMode, isPending: alarmMutating } = useAlarmMutation();
  const isSidebarHidden = useMatches({ base: true, md: false });

  useTick(30000);

  if (isPending || isError || !security) {
    return <Card withBorder padding="lg" h="100%" />;
  }

  const mode = security.alarmMode;
  const activationCount = security.activations.length;
  // security.activations is in time-order (ascending), so the most recent is always last.
  const lastActivation = activationCount === 0 ? null : security.activations[activationCount - 1];

  // "Alerting" = there's a recent activation whose alert window (loud siren, or the quiet
  // grace period after a single motion trigger) hasn't elapsed yet - i.e. something just
  // happened and is still live, as opposed to a historic activation from earlier this arming.
  const isAlerting = lastActivation !== null
    && dayjs().isBefore(lastActivation.suppressFurtherAlertsUntil);

  return (
    <Card withBorder padding="lg" h="100%">
      <Group justify="space-between" wrap="wrap" gap="md" align="flex-start">
        <Group gap="md" align="flex-start">
          <KpiIcon icon={faShieldHalved} color={MODE_COLORS[mode]} />
          <Stack gap={0} justify="center" className={styles.iconAlignedText}>
            <Badge color={MODE_COLORS[mode]} size="lg">{MODE_LABELS[mode]}</Badge>
            {security.start && (
              <Text size="sm" c="dimmed" mt={4}>
                Armed since {dayjs(security.start).format('HH:mm')} {humanDate(dayjs(security.start))}
              </Text>
            )}
            {mode !== 'OFF' && (
              <Text size="sm" c="dimmed">
                {activationCount === 0
                  ? 'No activations this arming'
                  : `${activationCount} activation${activationCount === 1 ? '' : 's'} this arming, ${isAlerting ? 'ongoing since' : 'last at'} ${dayjs(lastActivation!.startedAt).format('HH:mm')} ${humanDate(dayjs(lastActivation!.startedAt))}`}
              </Text>
            )}
          </Stack>
        </Group>

        {isSidebarHidden && (
          <SegmentedControl
            value={mode}
            onChange={(value) => updateAlarmMode({ alarmMode: value as AlarmMode })}
            disabled={alarmMutating}
            data={[
              { label: 'Home', value: 'OFF' },
              { label: 'Away', value: 'AWAY' },
              { label: 'Night', value: 'NIGHT' },
            ]}
          />
        )}
      </Group>

      {isAlerting && (
        <Alert
          mt="md"
          color={mode === 'NIGHT' ? 'grape' : 'red'}
          icon={<FontAwesomeIcon icon={faBell} className={styles.alertBellIcon} />}
        >
          Triggered by {lastActivation!.triggeringDevice.name}. Further alerts suppressed until {dayjs(lastActivation!.suppressFurtherAlertsUntil).format('HH:mm')}.
        </Alert>
      )}
    </Card>
  );
}

// Generic "are all these devices in the good state?" tile, shared by DoorsTile and
// WindowsAndDoorsTile - "healthy" when there's at least one device and none of them are
// reported as an issue, "-" when there are no devices at all to report on.
function KpiTile({ label, allDevices, issues, issueIcon, issueColor, healthyIcon, healthyLabel }: {
  label: string;
  allDevices: { name: string }[];
  issues: string[];
  issueIcon: IconDefinition;
  issueColor: string;
  healthyIcon: IconDefinition;
  healthyLabel: string;
}) {
  const isHealthy = allDevices.length > 0 && issues.length === 0;

  return (
    <Card withBorder padding="md" h="100%" className={styles.kpiTile}>
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <KpiIcon icon={isHealthy ? healthyIcon : issueIcon} color={allDevices.length === 0 ? undefined : isHealthy ? 'green' : issueColor} />
        <Stack gap={0} justify="center" className={styles.iconAlignedText}>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text fw={600}>{allDevices.length === 0 ? '-' : isHealthy ? healthyLabel : issues.join(' · ')}</Text>
        </Stack>
      </Group>
    </Card>
  );
}

function DoorsTile() {
  const { data: devicesData } = useDevices();

  const locks = devicesData
    ? forDeviceCapability(devicesData.devices, 'LOCK', (device, cap) => ({ name: device.name, isLocked: cap.isLocked.value }))
    : [];
  const unlockedDoors = locks.filter((lock) => lock.isLocked !== true).map((lock) => lock.name);

  return (
    <KpiTile
      label="Doors"
      allDevices={locks}
      issues={unlockedDoors}
      issueIcon={faDoorOpen}
      issueColor="red"
      healthyIcon={faDoorClosed}
      healthyLabel="All locked"
    />
  );
}

function WindowsAndDoorsTile() {
  const { data: devicesData } = useDevices();

  const contacts = devicesData
    ? forDeviceCapability(devicesData.devices, 'CONTACT_SENSOR', (device, cap) => ({ name: device.name, isOpen: cap.isOpen.value }))
    : [];
  const openContacts = contacts.filter((contact) => contact.isOpen !== false).map((contact) => contact.name);

  return (
    <KpiTile
      label="Windows & doors"
      allDevices={contacts}
      issues={openContacts}
      issueIcon={faDoorOpen}
      issueColor="orange"
      healthyIcon={faDoorClosed}
      healthyLabel="All closed"
    />
  );
}

function formatSlotDay(instant: string): string {
  const day = dayjs(instant);

  if (day.isSame(dayjs(), 'day')) {
    return 'Today';
  }

  if (day.isSame(dayjs().add(1, 'day'), 'day')) {
    return 'Tomorrow';
  }

  return day.format('ddd D MMM');
}

function formatSlot(start: string, end: string): string {
  return `${formatSlotDay(start)}, ${dayjs(start).format('HH:mm')}–${dayjs(end).format('HH:mm')}`;
}

function SilencingWindowTile() {
  const { data } = useSilencingWindows();

  useTick(30000);

  const [next, following]: (SilencingWindowOccurrenceApiResponse | undefined)[] = data?.upcoming ?? [];

  if (!next) {
    return (
      <Card withBorder padding="md" h="100%" className={styles.kpiTile}>
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <KpiIcon icon={faBellSlash} />
          <Stack gap={0} justify="center" className={styles.iconAlignedText}>
            <Text size="xs" c="dimmed">Next silencing window</Text>
            <Text fw={600}>{data ? 'None scheduled' : '-'}</Text>
          </Stack>
        </Group>
      </Card>
    );
  }

  const isActive = next.start !== null && dayjs().isAfter(next.start) && dayjs().isBefore(next.end);

  return (
    <Card withBorder padding="md" h="100%" className={styles.kpiTile}>
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <KpiIcon icon={faBellSlash} color={isActive ? 'blue' : undefined} />
        <Stack gap={0} justify="center" className={styles.iconAlignedText}>
          <Group gap={6} wrap="nowrap">
            <Text size="xs" c="dimmed">Next silencing window</Text>
            {isActive && <Badge size="xs" color="blue">Active</Badge>}
            {next.status === 'RESCHEDULED' && <Badge size="xs" color="orange" variant="light">Moved</Badge>}
            {next.status === 'CANCELLED' && <Badge size="xs" color="gray" variant="light">Cancelled</Badge>}
          </Group>

          {next.status === 'CANCELLED' ? (
            <Text fw={600} td="line-through" c="dimmed">{formatSlot(next.scheduledStart, next.scheduledEnd)}</Text>
          ) : isActive ? (
            <Text fw={600}>Now, until {dayjs(next.end).format('HH:mm')}</Text>
          ) : (
            <Text fw={600}>{formatSlot(next.start!, next.end!)}</Text>
          )}

          <Text size="sm" c="dimmed">
            {next.name}
            {next.status === 'RESCHEDULED' && ` · moved from ${formatSlotDay(next.scheduledStart)}`}
          </Text>

          {next.status === 'CANCELLED' && following && (
            <Text size="sm" mt={4}>
              Then {formatSlot(following.start!, following.end!)}
              {following.status === 'RESCHEDULED' && (
                <Text span size="sm" c="dimmed"> (moved from {formatSlotDay(following.scheduledStart)})</Text>
              )}
            </Text>
          )}
        </Stack>
      </Group>
    </Card>
  );
}

function MotionHeatmapCard({ data }: { data: SecurityInsightsApiResponse['motionByDeviceHour'] }) {
  const rows = useMemo(() => (
    [...data].sort((a, b) => a.deviceName.localeCompare(b.deviceName) || (a.zoneName ?? '').localeCompare(b.zoneName ?? ''))
  ), [data]);

  const maxCount = Math.max(1, ...rows.flatMap((row) => row.countByHour));

  return (
    <Card withBorder mt="lg" padding="lg">
      <Title order={4} mb="md">Motion by zone</Title>

      {rows.length === 0 ? (
        <Text c="dimmed">No motion recorded in this range.</Text>
      ) : (
        <div className={styles.heatmapScroll}>
          <table className={styles.heatmapTable}>
            <thead>
              <tr>
                <th className={styles.heatmapCornerCell}></th>
                {Array.from({ length: 24 }, (_, hour) => (
                  <th key={hour} className={styles.heatmapHour}>{hour}</th>
                ))}
                <th className={`${styles.heatmapHour} ${styles.heatmapLastMotionHeader}`}>Last motion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ deviceId, instanceId, deviceName, zoneName, countByHour, lastMotion }) => (
                <tr key={`${deviceId}:${instanceId ?? ''}`} className={styles.heatmapRow}>
                  <th className={styles.heatmapRowLabel}>
                    <div className={styles.heatmapRowLabelScroll}>
                      <Anchor component={Link} to={`/device/${deviceId}`}>{deviceName}</Anchor>
                      {zoneName && <Text size="xs" c="dimmed">{zoneName}</Text>}
                    </div>
                  </th>
                  {countByHour.map((count, hour) => (
                    <td
                      key={hour}
                      className={styles.heatmapCell}
                      style={{ backgroundColor: count === 0 ? undefined : `rgba(4, 167, 244, ${0.15 + 0.85 * (count / maxCount)})` }}
                      title={`${count} motion event${count === 1 ? '' : 's'}`}
                    >
                      {count > 0 ? count : ''}
                    </td>
                  ))}
                  <td className={styles.heatmapLastMotionCell}>
                    {lastMotion ? `${dayjs(lastMotion).format('HH:mm')} ${humanDate(dayjs(lastMotion))}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

type TimelineEventKind = 'arming' | 'activation' | 'motion' | 'lock' | 'contact' | 'doorbell' | 'connectivity';

const KIND_LABELS: Record<TimelineEventKind, string> = {
  arming: 'Alarm arming',
  activation: 'Alarm triggered',
  motion: 'Motion',
  lock: 'Locks',
  contact: 'Doors & windows',
  doorbell: 'Doorbell',
  connectivity: 'Connectivity',
};

const ALL_KINDS = Object.keys(KIND_LABELS) as TimelineEventKind[];

interface MergedEvent {
  kind: TimelineEventKind;
  deviceId: number | null;
  deviceName: string | null;
  // Set only for events tied to one instance of a multi-instance capability (e.g. a motion
  // event from one zone of a Presence sensor). Composite with deviceId since instance ids are
  // only unique within their own device.
  zoneKey: string | null;
  zoneName: string | null;
  item: TimelineItem;
}

function buildTimelineEvents(data: SecurityInsightsApiResponse): MergedEvent[] {
  const events: MergedEvent[] = [];

  for (const arming of data.armings) {
    events.push({
      kind: 'arming',
      deviceId: null,
      deviceName: null,
      zoneKey: null,
      zoneName: null,
      item: {
        timestamp: arming.start,
        icon: faShieldHalved,
        title: `Alarm set to ${arming.mode === 'AWAY' ? 'Away' : 'Night'}`,
      },
    });

    if (arming.end) {
      events.push({
        kind: 'arming',
        deviceId: null,
        deviceName: null,
        zoneKey: null,
        zoneName: null,
        item: {
          timestamp: arming.end,
          icon: faShieldHalved,
          title: 'Alarm turned off',
        },
      });
    }

    for (const activation of arming.activations) {
      events.push({
        kind: 'activation',
        deviceId: activation.triggeringDevice.id,
        deviceName: activation.triggeringDevice.name,
        zoneKey: null,
        zoneName: null,
        item: {
          timestamp: activation.startedAt,
          icon: faBell,
          iconColor: '#e74c3c',
          title: `Alarm triggered by ${activation.triggeringDevice.name}`,
        },
      });
    }
  }

  for (const event of data.motionEvents) {
    events.push({
      kind: 'motion',
      deviceId: event.deviceId,
      deviceName: event.deviceName,
      zoneKey: event.instanceId !== null ? `${event.deviceId}:${event.instanceId}` : null,
      zoneName: event.instanceName,
      item: {
        timestamp: event.start,
        icon: faPersonWalking,
        title: `Motion detected by ${event.deviceName}${event.instanceName ? ` (${event.instanceName})` : ''}`,
        renderControls: event.recordingId !== null ? ({ togglePanel }) => [
          <a key="view" href="#" onClick={(e) => { e.preventDefault(); togglePanel('view'); }} className="card-link">view</a>,
          <a key="download" href={`/api/recording/${event.recordingId}?download=true`} className="card-link">download</a>,
        ] : undefined,
        panels: event.recordingId !== null ? {
          view: <video width="100%" controls src={`/api/recording/${event.recordingId}`} />,
        } : undefined,
      },
    });
  }

  for (const event of data.lockEvents) {
    events.push({
      kind: 'lock',
      deviceId: event.deviceId,
      deviceName: event.deviceName,
      zoneKey: null,
      zoneName: null,
      item: {
        timestamp: event.timestamp,
        icon: event.isLocked ? faDoorClosed : faDoorOpen,
        title: `${event.deviceName} was ${event.isLocked ? 'locked' : 'unlocked'}`,
      },
    });
  }

  for (const event of data.contactEvents) {
    events.push({
      kind: 'contact',
      deviceId: event.deviceId,
      deviceName: event.deviceName,
      zoneKey: null,
      zoneName: null,
      item: {
        timestamp: event.timestamp,
        icon: event.isOpen ? faDoorOpen : faDoorClosed,
        title: `${event.deviceName} was ${event.isOpen ? 'opened' : 'closed'}`,
      },
    });
  }

  for (const event of data.doorbellRings) {
    events.push({
      kind: 'doorbell',
      deviceId: event.deviceId,
      deviceName: event.deviceName,
      zoneKey: null,
      zoneName: null,
      item: {
        timestamp: event.timestamp,
        icon: faBell,
        title: `Someone rang the doorbell (${event.deviceName})`,
        renderControls: event.hasThumbnail ? ({ togglePanel }) => [
          <a key="view" href="#" onClick={(e) => { e.preventDefault(); togglePanel('view'); }} className="card-link">view</a>,
        ] : undefined,
        panels: event.hasThumbnail ? {
          view: <img width="100%" src={`/api/event/${event.id}/thumbnail`} />,
        } : undefined,
      },
    });
  }

  for (const event of data.connectivityEvents) {
    events.push({
      kind: 'connectivity',
      deviceId: event.deviceId,
      deviceName: event.deviceName,
      zoneKey: null,
      zoneName: null,
      item: {
        timestamp: event.timestamp,
        icon: faSignal,
        iconColor: event.isConnected ? undefined : '#e74c3c',
        title: `${event.deviceName} went ${event.isConnected ? 'online' : 'offline'}`,
      },
    });
  }

  return events;
}

// A "sensor" in the filter UI is either a plain device (most events) or one zone of a
// multi-instance device (a Presence sensor's motion events) - merged into one list since from
// a user's perspective a zone reads as its own sensor, not a sub-filter of its parent device.
function sensorKeyOf(event: MergedEvent): string | null {
  return event.zoneKey ?? (event.deviceId !== null ? `device:${event.deviceId}` : null);
}

function sensorNameOf(event: MergedEvent): string | null {
  return event.zoneKey !== null && event.zoneName !== null && event.deviceName !== null
    ? `${event.deviceName} · ${event.zoneName}`
    : event.deviceName;
}

function TimelineCard({ data }: { data: SecurityInsightsApiResponse }) {
  const allEvents = useMemo(() => buildTimelineEvents(data), [data]);
  const [selectedKinds, setSelectedKinds] = useState<Set<TimelineEventKind> | null>(null);
  const [selectedSensors, setSelectedSensors] = useState<Set<string> | null>(null);

  const sensorOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const event of allEvents) {
      const key = sensorKeyOf(event);
      const name = sensorNameOf(event);

      if (key !== null && name !== null) {
        map.set(key, name);
      }
    }

    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allEvents]);

  const filtered = allEvents.filter((event) => {
    const sensorKey = sensorKeyOf(event);

    return (selectedKinds === null || selectedKinds.has(event.kind))
      && (selectedSensors === null || sensorKey === null || selectedSensors.has(sensorKey));
  });

  const selectedKindCount = selectedKinds === null ? ALL_KINDS.length : selectedKinds.size;
  const selectedSensorCount = selectedSensors === null ? sensorOptions.length : selectedSensors.size;

  function toggleKind(kind: TimelineEventKind) {
    setSelectedKinds((prev) => {
      const next = new Set(prev ?? ALL_KINDS);

      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }

      return next;
    });
  }

  function toggleSensor(key: string) {
    setSelectedSensors((prev) => {
      const next = new Set(prev ?? sensorOptions.map(([sensorKey]) => sensorKey));

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  return (
    <Card withBorder mt="lg" padding="lg">
      <Group justify="space-between" mb="md" wrap="wrap">
        <Title order={4}>Timeline</Title>

        <Group gap="xs">
          <Menu closeOnItemClick={false} shadow="md">
            <Menu.Target>
              <Button variant="default" size="xs">{selectedKindCount}/{ALL_KINDS.length} types</Button>
            </Menu.Target>
            <Menu.Dropdown>
              {ALL_KINDS.map((kind) => (
                <Menu.Item key={kind} onClick={() => toggleKind(kind)}>
                  <Group gap="xs" wrap="nowrap">
                    <Checkbox.Indicator size="xs" checked={selectedKinds === null || selectedKinds.has(kind)} />
                    <Text size="xs">{KIND_LABELS[kind]}</Text>
                  </Group>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          <Menu closeOnItemClick={false} shadow="md">
            <Menu.Target>
              <Button variant="default" size="xs">{selectedSensorCount}/{sensorOptions.length} sensors</Button>
            </Menu.Target>
            <Menu.Dropdown>
              {sensorOptions.map(([key, name]) => (
                <Menu.Item key={key} onClick={() => toggleSensor(key)}>
                  <Group gap="xs" wrap="nowrap">
                    <Checkbox.Indicator size="xs" checked={selectedSensors === null || selectedSensors.has(key)} />
                    <Text size="xs">{name}</Text>
                  </Group>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {filtered.length === 0 ? (
        <Text c="dimmed">No events in this range.</Text>
      ) : (
        <Timeline items={filtered.map((event) => event.item)} dayHeaderOrder={5} />
      )}
    </Card>
  );
}

function RangeDependentSection() {
  const { globalRange } = useDateRange();

  const params = useMemo(() => ({
    since: globalRange.since.toISOString(),
    until: globalRange.until.toISOString(),
  }), [globalRange.since, globalRange.until]);

  const { data, isPending, isError } = useSecurityInsights(params);

  if (isPending) {
    return <PageLoader />;
  }

  if (isError || !data) {
    return <Box style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading data</Box>;
  }

  return (
    <>
      <MotionHeatmapCard data={data.motionByDeviceHour} />
      <TimelineCard data={data} />
    </>
  );
}

export default function SecurityInsights() {
  const { cameras } = useCameraDevices();

  return (
    <>
      <Security cameras={cameras} />

      <Box p="md">
        <Title order={2}>Security</Title>

        {/* Status card + KPI strip always reflect "right now" - each tile sources its own live
            data (useSecurity / useDevices) independent of the timeline's date range selector
            below them, so switching the range never reloads/reflows anything above it. */}
        <Grid mt="lg" columns={24}>
          <Grid.Col span={{ base: 24, md: 12, lg: 7 }}>
            <StatusCard />
          </Grid.Col>
          <Grid.Col span={{ base: 24, md: 12, lg: 7 }}>
            <SilencingWindowTile />
          </Grid.Col>
          <Grid.Col span={{ base: 24, xs: 12, lg: 5 }}>
            <DoorsTile />
          </Grid.Col>
          <Grid.Col span={{ base: 24, xs: 12, lg: 5 }}>
            <WindowsAndDoorsTile />
          </Grid.Col>
        </Grid>

        <DateRangeProvider defaultPreset="today">
          <Box mt="lg">
            <DateRangeSelector />
          </Box>

          <RangeDependentSection />
        </DateRangeProvider>
      </Box>
    </>
  );
}
