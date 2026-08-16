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
} from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBell,
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
import { DateRangeProvider, DateRangeSelector, useDateRange } from '../date-range';
import { forDeviceCapability } from '../../helpers/device';
import { humanDate } from '../../helpers/date';
import dayjs from '../../dayjs';
import PageLoader from '../page-loader';
import Security from '../security';
import Timeline from '../timeline/timeline';
import type { TimelineItem } from '../timeline/timeline';
import type { AlarmMode, SecurityInsightsApiResponse } from '../../api/types';
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

function MotionHeatmapCard({ data }: { data: SecurityInsightsApiResponse['motionByDeviceHour'] }) {
  const rows = useMemo(() => (
    [...data].sort((a, b) => a.label.localeCompare(b.label))
  ), [data]);

  const maxCount = Math.max(1, ...rows.flatMap((row) => row.countByHour));

  return (
    <Card withBorder mt="lg" padding="lg">
      <Title order={4} mb="md">Motion by device</Title>

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
              {rows.map(({ deviceId, label, countByHour, lastMotion }) => (
                <tr key={deviceId} className={styles.heatmapRow}>
                  <th className={styles.heatmapRowLabel}>
                    <Anchor component={Link} to={`/device/${deviceId}`}>{label}</Anchor>
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
  item: TimelineItem;
}

function buildTimelineEvents(data: SecurityInsightsApiResponse): MergedEvent[] {
  const events: MergedEvent[] = [];

  for (const arming of data.armings) {
    events.push({
      kind: 'arming',
      deviceId: null,
      deviceName: null,
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
      item: {
        timestamp: event.start,
        icon: faPersonWalking,
        title: `Motion detected by ${event.deviceName}`,
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

function TimelineCard({ data }: { data: SecurityInsightsApiResponse }) {
  const allEvents = useMemo(() => buildTimelineEvents(data), [data]);
  const [selectedKinds, setSelectedKinds] = useState<Set<TimelineEventKind> | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<number> | null>(null);

  const deviceOptions = useMemo(() => {
    const map = new Map<number, string>();

    for (const event of allEvents) {
      if (event.deviceId !== null && event.deviceName !== null) {
        map.set(event.deviceId, event.deviceName);
      }
    }

    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allEvents]);

  const filtered = allEvents.filter((event) =>
    (selectedKinds === null || selectedKinds.has(event.kind))
    && (selectedDevices === null || event.deviceId === null || selectedDevices.has(event.deviceId))
  );

  const selectedKindCount = selectedKinds === null ? ALL_KINDS.length : selectedKinds.size;
  const selectedDeviceCount = selectedDevices === null ? deviceOptions.length : selectedDevices.size;

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

  function toggleDevice(id: number) {
    setSelectedDevices((prev) => {
      const next = new Set(prev ?? deviceOptions.map(([deviceId]) => deviceId));

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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
                  <Checkbox
                    readOnly
                    size="xs"
                    label={KIND_LABELS[kind]}
                    checked={selectedKinds === null || selectedKinds.has(kind)}
                  />
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          <Menu closeOnItemClick={false} shadow="md">
            <Menu.Target>
              <Button variant="default" size="xs">{selectedDeviceCount}/{deviceOptions.length} devices</Button>
            </Menu.Target>
            <Menu.Dropdown>
              {deviceOptions.map(([id, name]) => (
                <Menu.Item key={id} onClick={() => toggleDevice(id)}>
                  <Checkbox
                    readOnly
                    size="xs"
                    label={name}
                    checked={selectedDevices === null || selectedDevices.has(id)}
                  />
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
        <Grid mt="lg">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <StatusCard />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <DoorsTile />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
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
