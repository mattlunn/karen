import React, { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
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

// ============================================================================
// Live camera snapshots
// ============================================================================

function CameraRow() {
  const { data, isLoading } = useDevices();

  if (isLoading || !data) {
    return null;
  }

  const cameras = forDeviceCapability(data.devices, 'CAMERA', (device, capability) => ({
    id: device.id,
    name: device.name,
    snapshotUrl: capability.snapshotUrl.value,
  }));

  if (cameras.length === 0) {
    return null;
  }

  return <Security cameras={cameras} />;
}

// ============================================================================
// Alarm status card
// ============================================================================

function StatusCard({ currentArming }: { currentArming: SecurityInsightsApiResponse['currentArming'] }) {
  const { data: security } = useSecurity();
  const { mutate: updateAlarmMode, isPending: alarmMutating } = useAlarmMutation();

  const mode = security?.alarmMode ?? currentArming.mode;

  return (
    <Card withBorder mt="lg" padding="lg">
      <Group justify="space-between" wrap="wrap" gap="md">
        <Group gap="md">
          <FontAwesomeIcon icon={faShieldHalved} size="2x" />
          <div>
            <Badge color={MODE_COLORS[mode]} size="lg">{MODE_LABELS[mode]}</Badge>
            {currentArming.start && (
              <Text size="sm" c="dimmed" mt={4}>
                Armed since {dayjs(currentArming.start).format('HH:mm')} {humanDate(dayjs(currentArming.start))}
              </Text>
            )}
          </div>
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

      {currentArming.lastActivation && (
        <Alert mt="md" color="red" icon={<FontAwesomeIcon icon={faBell} />}>
          Alarm was triggered at {dayjs(currentArming.lastActivation.start).format('HH:mm')} {humanDate(dayjs(currentArming.lastActivation.start))}
          {currentArming.lastActivation.triggeringDevice ? ` by ${currentArming.lastActivation.triggeringDevice.name}` : ''}.
          {currentArming.lastActivation.end ? ` Further alerts suppressed until ${dayjs(currentArming.lastActivation.end).format('HH:mm')}.` : ''}
        </Alert>
      )}
    </Card>
  );
}

// ============================================================================
// KPI strip
// ============================================================================

function KpiTile({ icon, label, value, color }: { icon: IconDefinition; label: string; value: string; color?: string }) {
  return (
    <Card withBorder padding="md" className={styles.kpiTile}>
      <Group gap="sm" wrap="nowrap">
        <FontAwesomeIcon icon={icon} size="lg" color={color} />
        <Stack gap={0}>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text fw={600}>{value}</Text>
        </Stack>
      </Group>
    </Card>
  );
}

function KpiStrip({ data }: { data: SecurityInsightsApiResponse }) {
  const { data: devicesData } = useDevices();

  const motionCount = data.motionEvents.length;
  const activationCount = data.armings.reduce((sum, arming) => sum + arming.activations.length, 0);

  const locks = devicesData
    ? forDeviceCapability(devicesData.devices, 'LOCK', (device, cap) => ({ name: device.name, isLocked: cap.isLocked.value }))
    : [];
  const unlockedDoors = locks.filter((lock) => lock.isLocked !== true).map((lock) => lock.name);
  const allLocked = locks.length > 0 && unlockedDoors.length === 0;

  const contacts = devicesData
    ? forDeviceCapability(devicesData.devices, 'CONTACT_SENSOR', (device, cap) => ({ name: device.name, isOpen: cap.isOpen.value }))
    : [];
  const openContacts = contacts.filter((contact) => contact.isOpen !== false).map((contact) => contact.name);
  const allClosed = contacts.length > 0 && openContacts.length === 0;

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} mt="lg">
      <KpiTile icon={faPersonWalking} label="Motion events" value={String(motionCount)} color="#04A7F4" />
      <KpiTile
        icon={faBell}
        label="Alarm activations"
        value={String(activationCount)}
        color={activationCount > 0 ? '#e74c3c' : undefined}
      />
      <KpiTile
        icon={allLocked ? faDoorClosed : faDoorOpen}
        label="Doors"
        value={locks.length === 0 ? '-' : allLocked ? 'All locked' : unlockedDoors.join(' · ')}
        color={locks.length === 0 ? undefined : allLocked ? '#2ecc71' : '#e74c3c'}
      />
      <KpiTile
        icon={allClosed ? faDoorClosed : faDoorOpen}
        label="Windows & doors"
        value={contacts.length === 0 ? '-' : allClosed ? 'All closed' : openContacts.join(' · ')}
        color={contacts.length === 0 ? undefined : allClosed ? '#2ecc71' : '#f39c12'}
      />
    </SimpleGrid>
  );
}

// ============================================================================
// Motion-by-room heatmap
// ============================================================================

function MotionHeatmapCard({ data, rangeLabel }: { data: SecurityInsightsApiResponse['motionByRoomHour']; rangeLabel: string }) {
  const rows = useMemo(() => {
    const byLabel = new Map<string, number[]>();

    for (const { label, hour, count } of data) {
      if (!byLabel.has(label)) {
        byLabel.set(label, new Array(24).fill(0));
      }

      byLabel.get(label)![hour] += count;
    }

    return [...byLabel.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  const maxCount = Math.max(1, ...rows.flatMap(([, hours]) => hours));

  return (
    <Card withBorder mt="lg" padding="lg">
      <Title order={4} mb="md">Motion by room · {rangeLabel}</Title>

      {rows.length === 0 ? (
        <Text c="dimmed">No motion recorded in this range.</Text>
      ) : (
        <div className={styles.heatmapScroll}>
          <table className={styles.heatmapTable}>
            <thead>
              <tr>
                <th></th>
                {Array.from({ length: 24 }, (_, hour) => (
                  <th key={hour} className={styles.heatmapHour}>{hour}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, hours]) => (
                <tr key={label}>
                  <th className={styles.heatmapRowLabel}>{label}</th>
                  {hours.map((count, hour) => (
                    <td
                      key={hour}
                      className={styles.heatmapCell}
                      style={{ backgroundColor: count === 0 ? undefined : `rgba(4, 167, 244, ${0.15 + 0.85 * (count / maxCount)})` }}
                      title={`${count} motion event${count === 1 ? '' : 's'}`}
                    >
                      {count > 0 ? count : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// Timeline card
// ============================================================================

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
        deviceId: activation.triggeringDevice?.id ?? null,
        deviceName: activation.triggeringDevice?.name ?? null,
        item: {
          timestamp: activation.startedAt,
          icon: faBell,
          iconColor: '#e74c3c',
          title: activation.triggeringDevice
            ? `Alarm triggered by ${activation.triggeringDevice.name}`
            : 'Alarm triggered',
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
              <Button variant="default" size="xs">All types</Button>
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
              <Button variant="default" size="xs">All devices</Button>
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

// ============================================================================
// Page
// ============================================================================

function SecurityInsightsContent() {
  const { globalRange, activePreset } = useDateRange();

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

  const rangeLabel = activePreset === 'custom'
    ? `${globalRange.since.format('D MMM')} – ${globalRange.until.format('D MMM')}`
    : { last6hours: 'last 6 hours', today: 'today', yesterday: 'yesterday', lastMonth: 'last month' }[activePreset];

  return (
    <>
      <StatusCard currentArming={data.currentArming} />
      <KpiStrip data={data} />
      <MotionHeatmapCard data={data.motionByRoomHour} rangeLabel={rangeLabel} />
      <TimelineCard data={data} />
    </>
  );
}

export default function SecurityInsights() {
  return (
    <>
      <Title order={2}>Security</Title>

      <Box mt="md">
        <CameraRow />
      </Box>

      <DateRangeProvider defaultPreset="today">
        <Box mt="md">
          <DateRangeSelector />
        </Box>

        <SecurityInsightsContent />
      </DateRangeProvider>
    </>
  );
}
