import React from 'react';
import { NativeSelect } from '@mantine/core';
import {
  faLightbulb,
  faThermometerQuarter,
  faThermometerFull,
  faDroplet,
  faFire,
  faCircleHalfStroke,
  faPersonWalking,
  faVideo,
  faToggleOn,
  faToggleOff,
  faDoorClosed,
  faDoorOpen,
  faVolumeHigh,
  faVolumeXmark,
  faBatteryFull,
  faBatteryHalf,
  faBatteryQuarter,
  faBatteryEmpty,
  faLeaf,
  faBolt,
  faFaucet,
  faFaucetDrip,
  faTree,
  faThermometer2,
  faThermometer4,
  faGauge,
  faRoad,
  faCalendarCheck,
  faPlug,
  faTrash,
  faHandPointer,
  faSnowflake,
  faCalendarDay,
  faHashtag,
  faBell,
  faSignal,
  faTv,
  faSterlingSign,
} from '@fortawesome/free-solid-svg-icons';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import type { CapabilityApiResponse, RestDeviceResponse, DeviceApiResponse, LightUpdateRequest, LockUpdateRequest, SwitchUpdateRequest, TelevisionUpdateRequest } from '../../api/types';
import ThermostatModal from '../modals/thermostat-modal';
import ChargeScheduleModal from '../modals/charge-schedule-modal';
import ChargeLimitModal from '../modals/charge-limit-modal';
import dayjs from '../../dayjs';
import { humanDate, formatDuration } from '../../helpers/date';
import type {
  MetricDisplayVariant,
  CapabilityUIRegistry,
  CapabilityMetric,
  CapabilityEvent,
  CreateCapabilityConfig,
} from './types';

// ============================================================================
// Mutation Functions
// ============================================================================

async function updateLight(deviceId: number, data: LightUpdateRequest): Promise<DeviceApiResponse> {
  const res = await fetch(`/api/device/${deviceId}/light`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update light');
  return res.json();
}

async function updateLock(deviceId: number, data: LockUpdateRequest): Promise<DeviceApiResponse> {
  const res = await fetch(`/api/device/${deviceId}/lock`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update lock');
  return res.json();
}

async function updateSwitch(deviceId: number, data: SwitchUpdateRequest): Promise<DeviceApiResponse> {
  const res = await fetch(`/api/device/${deviceId}/switch`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update switch');
  return res.json();
}

async function updateTelevision(deviceId: number, data: TelevisionUpdateRequest): Promise<DeviceApiResponse> {
  const res = await fetch(`/api/device/${deviceId}/television`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update television');
  return res.json();
}

function updateDeviceCache(queryClient: QueryClient, deviceId: number, data: DeviceApiResponse) {
  queryClient.setQueryData(['device', deviceId], data);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryClient.setQueryData(['devices'], (old: any) => {
    if (!old) return old;
    return {
      ...old,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      devices: old.devices.map((device: any) =>
        device.id === deviceId ? data.device : device
      ),
    };
  });
}

// ============================================================================
// Metric Display Context
// ============================================================================

const MetricDisplayContext = React.createContext<MetricDisplayVariant>('compact');

export const MetricDisplayProvider = MetricDisplayContext.Provider;

// ============================================================================
// Interactive Controls
// ============================================================================

type LightCapability = Extract<CapabilityApiResponse, { type: 'LIGHT' }>;

function BrightnessControl({ device, capability }: { device: RestDeviceResponse; capability: LightCapability }) {
  const queryClient = useQueryClient();
  const variant = React.useContext(MetricDisplayContext);
  const brightness = capability.brightness.value ?? 100;

  const data: { value: string; label: string }[] = [];
  let selectedValue: string | undefined;

  for (let i = 0; i <= 100; i += 5) {
    const shouldSelect = i === brightness || (brightness < i && selectedValue === undefined);

    if (shouldSelect) {
      selectedValue = String(i);
    }

    data.push({ value: String(i), label: `${i}%` });
  }

  return (
    <NativeSelect
      data={data}
      defaultValue={selectedValue}
      onChange={async (e) => {
        const result = await updateLight(device.id, { brightness: Number(e.target.value) });
        updateDeviceCache(queryClient, device.id, result);
      }}
      size={variant === 'compact' ? 'xs' : 'xl'}
      w="fit-content"
      display={variant === 'compact' ? 'inline-block' : 'block'}
    />
  );
}

type TelevisionCapability = Extract<CapabilityApiResponse, { type: 'TELEVISION' }>;

function VolumeControl({ device, capability }: { device: RestDeviceResponse; capability: TelevisionCapability }) {
  const queryClient = useQueryClient();
  const variant = React.useContext(MetricDisplayContext);
  const volume = capability.volume.value ?? 0;

  const data: { value: string; label: string }[] = [];
  let selectedValue: string | undefined;

  for (let i = 0; i <= 100; i += 5) {
    const shouldSelect = i === volume || (volume < i && selectedValue === undefined);
    if (shouldSelect) {
      selectedValue = String(i);
    }
    data.push({ value: String(i), label: String(i) });
  }

  return (
    <NativeSelect
      data={data}
      defaultValue={selectedValue}
      onChange={async (e) => {
        const result = await updateTelevision(device.id, { volume: Number(e.target.value) });
        updateDeviceCache(queryClient, device.id, result);
      }}
      size={variant === 'compact' ? 'xs' : 'xl'}
      w="fit-content"
      display={variant === 'compact' ? 'inline-block' : 'block'}
    />
  );
}

function SourceControl({ device, capability }: { device: RestDeviceResponse; capability: TelevisionCapability }) {
  const queryClient = useQueryClient();
  const variant = React.useContext(MetricDisplayContext);
  const current = capability.currentSource.value ?? '';

  const inputs = capability.availableSources.filter(s => s.kind === 'input').map(s => s.label);
  const channels = capability.availableSources.filter(s => s.kind === 'channel').map(s => s.label);

  const groups: { group: string; items: string[] }[] = [];
  if (inputs.length > 0) groups.push({ group: 'Inputs', items: inputs });
  if (channels.length > 0) groups.push({ group: 'Channels', items: channels });

  return (
    <NativeSelect
      data={groups.length > 0 ? groups : [{ group: '', items: [current] }]}
      defaultValue={current}
      onChange={async (e) => {
        const result = await updateTelevision(device.id, { source: e.target.value });
        updateDeviceCache(queryClient, device.id, result);
      }}
      size={variant === 'compact' ? 'xs' : 'xl'}
      w="fit-content"
      display={variant === 'compact' ? 'inline-block' : 'block'}
    />
  );
}

// ============================================================================
// createCapability helper
// ============================================================================

function resolve<E, T>(value: T | ((event: E) => T), event: E): T {
  return typeof value === 'function' ? (value as (event: E) => T)(event) : value;
}

function hasNullValue(event: CapabilityEvent | null): boolean {
  return event !== null && 'value' in event && event.value === null;
}

/**
 * Builds a `CapabilityMetric` from a backing event and a config whose display
 * props may be plain values or functions of that event. `since` / `lastReported`
 * are taken from the event automatically; pass `null` as the event (with an
 * explicit `since` / `lastReported` or `footer`) for metrics with no event.
 *
 * When the backing event exists but its `value` is `null` (no observation yet),
 * we short-circuit to a uniform "no reading" rendering (a `-` value): only the
 * `icon` callback is invoked (each capability picks a sensible neutral icon for
 * the unobserved state); `value`, `iconColor`, `iconHighlighted` and `isIssue`
 * fall back to generic defaults so per-capability callbacks don't handle absence.
 */
function createCapability<E extends CapabilityEvent | null>(
  event: E,
  config: CreateCapabilityConfig<E>
): CapabilityMetric {
  if (hasNullValue(event)) {
    return {
      icon: resolve(config.icon, event),
      title: config.title,
      value: '-',
      iconColor: '#aaaaaa',
      iconHighlighted: false,
      onIconClick: config.onIconClick,
      since: event!.start,
      lastReported: event!.lastReported,
    };
  }

  // Callbacks past this point can assume `value` is non-null; the type system
  // is told via `WithObservedValue<E>` but the runtime hasn't narrowed `event`,
  // so we cast through `as never` to satisfy `resolve`'s signature.
  const observedEvent = event as never;
  const base = {
    icon: resolve(config.icon, event),
    title: config.title,
    value: resolve(config.value, observedEvent),
    iconColor: config.iconColor === undefined ? undefined : resolve(config.iconColor, observedEvent),
    iconHighlighted: config.iconHighlighted === undefined ? undefined : resolve(config.iconHighlighted, observedEvent),
    isIssue: config.isIssue === undefined ? undefined : resolve(config.isIssue, observedEvent),
    onIconClick: config.onIconClick,
  };

  if (config.since !== undefined && config.lastReported !== undefined) {
    return { ...base, since: config.since, lastReported: config.lastReported };
  }

  if (event !== null) {
    return { ...base, since: event.start, lastReported: event.lastReported };
  }

  return { ...base, footer: config.footer };
}

// ============================================================================
// Registry
// ============================================================================

export const registry: CapabilityUIRegistry = {
  CAMERA: {
    priority: 10,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.snapshotUrl, {
        icon: faVideo,
        title: 'Camera',
        value: 'Active',
        iconColor: '#04A7F4',
      }),
    ],
  },

  ELECTRIC_VEHICLE: {
    priority: 15,
    getCapabilityMetrics: (cap, device) => [
      createCapability(cap.odometer, {
        icon: faRoad,
        title: 'Mileage',
        value: (e) => `${Math.round(e.value).toLocaleString()} mi`,
      }),
      createCapability(cap.chargePercentage, {
        icon: (e) => {
          if (e.value === null || e.value <= 25) return faBatteryEmpty;
          if (e.value > 75) return faBatteryFull;
          if (e.value > 50) return faBatteryHalf;
          return faBatteryQuarter;
        },
        title: 'Battery',
        value: (e) => `${e.value.toFixed(0)}%`,
        iconColor: (e) => {
          if (e.value > 50) return '#2ecc71';
          if (e.value > 25) return '#f39c12';
          return '#e74c3c';
        },
        iconHighlighted: !!cap.isCharging.value,
      }),
      createCapability(cap.isCableConnected, {
        icon: faPlug,
        title: 'Cable',
        value: (e) => e.value ? 'Connected' : 'Disconnected',
        iconColor: '#04A7F4',
        iconHighlighted: (e) => e.value,
      }),
      createCapability(cap.isCharging, {
        icon: faBolt,
        title: 'Charging',
        value: (e) => e.value ? 'Yes' : 'No',
        iconColor: '#2ecc71',
        iconHighlighted: (e) => e.value,
      }),
      createCapability(cap.chargeLimit, {
        icon: faGauge,
        title: 'Charge Limit',
        value: (e) => `${e.value.toFixed(0)}%`,
        onIconClick: ({ openModal, closeModal }) => {
          openModal(<ChargeLimitModal device={device} capability={cap} closeModal={closeModal} />);
        },
      }),
      createCapability(null, {
        icon: faCalendarCheck,
        title: 'Schedule',
        value: cap.chargeSchedule
          ? `${cap.chargeSchedule.targetPercentage}% by ${dayjs(cap.chargeSchedule.targetTime).format('HH:mm')} ${humanDate(dayjs(cap.chargeSchedule.targetTime))}`
          : 'No schedule',
        footer: cap.chargeSchedule
          ? cap.chargeSchedule.calculatedStartTime
            ? `starts ${dayjs(cap.chargeSchedule.calculatedStartTime).format('HH:mm')} ${humanDate(dayjs(cap.chargeSchedule.calculatedStartTime))}`
            : 'start TBC'
          : undefined,
        iconColor: cap.chargeSchedule ? '#3498db' : undefined,
        onIconClick: ({ openModal, closeModal }) => {
          openModal(
            <ChargeScheduleModal device={device} capability={cap} closeModal={closeModal} />
          );
        },
      }),
    ],
    getGraphs: () => [
      {
        id: 'vehicle-charge',
        title: 'Charge & Limit',
        yMin: 0,
        yMax: 100,
        overridePreset: 'custom',
        overrideStart: dayjs().subtract(1, 'week').toISOString(),
        overrideEnd: dayjs().toISOString(),
      },
      {
        id: 'vehicle-weekly-mileage',
        title: 'Weekly Mileage',
        overridePreset: 'custom',
        overrideStart: dayjs().subtract(6, 'months').startOf('week').toISOString(),
        overrideEnd: dayjs().toISOString(),
      },
    ],
  },

  THERMOSTAT: {
    priority: 20,
    getCapabilityMetrics: (cap, device) => [
      createCapability(cap.currentTemperature, {
        icon: faThermometerFull,
        title: 'Current Temperature',
        value: (e) => `${e.value.toFixed(1)}°C`,
        iconColor: '#ff6f22',
        iconHighlighted: !!cap.isHeating.value,
        onIconClick: ({ openModal, closeModal }) => {
          openModal(
            <ThermostatModal device={device} capability={cap} closeModal={closeModal} />
          );
        },
      }),
      createCapability(cap.targetTemperature, {
        icon: faThermometerQuarter,
        title: 'Target Temperature',
        value: (e) => `${e.value.toFixed(1)}°C`,
        iconColor: '#ff6f22',
      }),
      createCapability(cap.power, {
        icon: faFire,
        title: 'Power',
        value: (e) => `${e.value}%`,
        iconColor: '#ff6f22',
      }),
      createCapability(cap.isPassive, {
        icon: faSnowflake,
        title: 'Passive',
        value: (e) => e.value ? 'Yes' : 'No',
        iconColor: '#aaaaaa',
      }),
    ],
    getGraphs: () => [
      {
        id: 'thermostat',
        title: 'Temperature & Power',
        yAxis: {
          yTemperature: { position: 'left', min: 0, max: 30 },
          yPercentage: { position: 'right', min: 0, max: 100 },
        },
      },
    ],
  },

  TELEVISION: {
    priority: 32,
    getCapabilityMetrics: (cap, device) => [
      createCapability(cap.volume, {
        icon: cap.isMuted.value ? faVolumeXmark : faVolumeHigh,
        title: 'Volume',
        value: <VolumeControl device={device} capability={cap} />,
        iconColor: '#04A7F4',
        iconHighlighted: !cap.isMuted.value,
        onIconClick: async ({ queryClient }) => {
          const data = await updateTelevision(device.id, { isMuted: !cap.isMuted.value });
          updateDeviceCache(queryClient, device.id, data);
        },
      }),
      createCapability(cap.currentSource, {
        icon: faTv,
        title: 'Source',
        value: cap.availableSources.length > 0
          ? <SourceControl device={device} capability={cap} />
          : (e) => e.value,
        iconColor: '#04A7F4',
      }),
    ],
  },

  HEAT_PUMP: {
    priority: 25,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.mode, {
        icon: faFire,
        title: 'Mode',
        value: (e) => `${e.value[0]}${e.value.slice(1).toLowerCase()}`,
        iconColor: '#04A7F4',
        iconHighlighted: (e) => e.value !== 'STANDBY',
      }),
      createCapability(cap.dayCoP, {
        icon: faLeaf,
        title: "Today's CoP",
        value: (e) => e.value.toFixed(1),
      }),
      createCapability(cap.dayPower, {
        icon: faBolt,
        title: "Today's Power",
        value: (e) => `${e.value.toFixed(1)} kWh`,
      }),
      createCapability(cap.dayYield, {
        icon: faFire,
        title: "Today's Yield",
        value: (e) => `${e.value.toFixed(1)} kWh`,
      }),
      createCapability(cap.outsideTemperature, {
        icon: faTree,
        title: 'Outside Temperature',
        value: (e) => `${e.value.toFixed(1)}°C`,
      }),
      createCapability(cap.dhwTemperature, {
        icon: faFaucetDrip,
        title: 'Hot Water Temperature',
        value: (e) => `${e.value.toFixed(1)}°C`,
      }),
      createCapability(cap.actualFlowTemperature, {
        icon: faThermometer4,
        title: 'Flow Temperature',
        value: (e) => `${e.value.toFixed(1)}°C`,
      }),
      createCapability(cap.returnTemperature, {
        icon: faThermometer2,
        title: 'Return Temperature',
        value: (e) => `${e.value.toFixed(1)}°C`,
      }),
      createCapability(cap.systemPressure, {
        icon: faGauge,
        title: 'System Pressure',
        value: (e) => `${e.value.toFixed(1)} bar`,
      }),
    ],
    getGraphs: () => [
      { id: 'heatpump-power', title: 'Power' },
      { id: 'heatpump-compressor-power', title: 'Compressor Power', yMin: 0 },
      { id: 'heatpump-compressor-modulation', title: 'Compressor Modulation', yMin: 0, yMax: 100 },
      { id: 'heatpump-cumulative-energy', title: 'Cumulative Energy (Wh)', yMin: 0 },
      { id: 'heatpump-outside-temp', title: 'Outside Temperature', yMin: -10 },
      { id: 'heatpump-dhw-temp', title: 'DHW Temperature' },
      { id: 'heatpump-flow-temp', title: 'Flow/ Return Temperatures' },
      {
        id: 'heatpump-pressure',
        title: 'System Pressure',
        zones: [
          { min: 0, max: 1, color: 'rgba(255, 0, 55, 0.25)' },
          { min: 1, max: 2, color: 'rgba(31, 135, 0, 0.25)' },
        ],
        yMin: 0,
        yMax: 2,
      },
      {
        id: 'heatpump-daily-metrics',
        title: 'Daily Overall Metrics',
        overridePreset: 'custom',
        overrideStart: dayjs().subtract(14, 'days').startOf('day').toISOString(),
        overrideEnd: dayjs().toISOString(),
        yAxis: {
          yCoP: { position: 'left' },
          yEnergy: { position: 'right' },
        },
      },
      {
        id: 'heatpump-daily-heating',
        title: 'Daily Heating Metrics',
        overridePreset: 'custom',
        overrideStart: dayjs().subtract(14, 'days').startOf('day').toISOString(),
        overrideEnd: dayjs().toISOString(),
        yAxis: {
          yCoP: { position: 'left' },
          yEnergy: { position: 'right' },
        },
      },
      {
        id: 'heatpump-daily-dhw',
        title: 'Daily DHW Metrics',
        overridePreset: 'custom',
        overrideStart: dayjs().subtract(14, 'days').startOf('day').toISOString(),
        overrideEnd: dayjs().toISOString(),
        yAxis: {
          yCoP: { position: 'left' },
          yEnergy: { position: 'right' },
        },
      },
    ],
  },

  LIGHT: {
    priority: 30,
    getCapabilityMetrics: (cap, device) => [
      createCapability(cap.isOn, {
        icon: faLightbulb,
        title: 'Status',
        value: (e) => e.value ? 'On' : 'Off',
        iconColor: '#ffa24d',
        iconHighlighted: (e) => e.value,
        onIconClick: async ({ queryClient }) => {
          const data = await updateLight(device.id, { isOn: !cap.isOn.value });
          updateDeviceCache(queryClient, device.id, data);
        },
      }),
      createCapability(cap.brightness, {
        icon: faCircleHalfStroke,
        title: 'Brightness',
        value: <BrightnessControl device={device} capability={cap} />,
      }),
    ],
    getGraphs: () => [
      { id: 'light', title: 'Activity' },
    ],
  },

  LOCK: {
    priority: 35,
    getCapabilityMetrics: (cap, device) => [
      createCapability(cap.isLocked, {
        icon: (e) => e.value === false ? faDoorOpen : faDoorClosed,
        title: 'Lock',
        value: (e) => e.value ? 'Locked' : 'Unlocked',
        iconColor: '#04A7F4',
        iconHighlighted: (e) => !e.value,
        onIconClick: async ({ queryClient }) => {
          const data = await updateLock(device.id, { isLocked: !cap.isLocked.value });
          updateDeviceCache(queryClient, device.id, data);
        },
      }),
    ],
  },

  SWITCH: {
    priority: 40,
    getCapabilityMetrics: (cap, device) => [
      createCapability(cap.isOn, {
        icon: (e) => e.value === true ? faToggleOn : faToggleOff,
        title: 'Switch',
        value: (e) => e.value ? 'On' : 'Off',
        iconColor: '#04A7F4',
        iconHighlighted: (e) => e.value,
        onIconClick: async ({ queryClient }) => {
          const data = await updateSwitch(device.id, { isOn: !cap.isOn.value });
          updateDeviceCache(queryClient, device.id, data);
        },
      }),
    ],
  },

  BIN_COLLECTION: {
    priority: 45,
    getCapabilityMetrics: (cap) => {
      const next = dayjs(cap.nextCollection.date);
      let footer: string | undefined;

      if (cap.nextCollection.isOverride) {
        const nextDateStr = next.format('YYYY-MM-DD');
        const originalDate = cap.overrides.find(o => o.newDate === nextDateStr)!.originalDate;

        footer = `Rescheduled from ${dayjs(originalDate).format('ddd D MMM')}`;
      }

      return [
        createCapability(null, {
          icon: faTrash,
          title: 'Next Collection',
          value: next.format('ddd D MMM'),
          footer,
          iconColor: cap.color,
        }),
      ];
    },
  },

  MOTION_SENSOR: {
    priority: 50,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.hasMotion, {
        icon: faPersonWalking,
        title: 'Motion',
        value: (e) => e.value ? 'Motion detected' : 'No motion',
        iconHighlighted: (e) => e.value,
        iconColor: '#04A7F4',
      }),
    ],
  },

  CONTACT_SENSOR: {
    priority: 55,
    getCapabilityMetrics: (cap) => {
      const metrics: CapabilityMetric[] = [
        createCapability(cap.isClosed, {
          icon: faBell,
          title: 'Status',
          value: (e) => e.value ? 'TRIGGERED' : 'OK',
          iconColor: (e) => e.value ? '#e74c3c' : '#2ecc71',
          iconHighlighted: (e) => e.value,
          isIssue: (e) => e.value,
        }),
      ];

      if (cap.lastTriggered) {
        const start = dayjs(cap.lastTriggered.start);
        const footer = cap.lastTriggered.durationSeconds === null
          ? 'Still active'
          : `Triggered for ${formatDuration(cap.lastTriggered.durationSeconds)}`;

        metrics.push(createCapability(null, {
          icon: faBell,
          title: 'Last Triggered',
          value: `${humanDate(start)} at ${start.format('HH:mm')}`,
          iconColor: '#04A7F4',
          footer,
        }));
      }

      return metrics;
    },
    getGraphs: () => [
      { id: 'contact-sensor', title: 'Activity' },
    ],
  },

  HUMIDITY_SENSOR: {
    priority: 60,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.humidity, {
        icon: faDroplet,
        title: 'Humidity',
        value: (e) => `${e.value}%`,
        iconColor: '#04A7F4',
      }),
    ],
  },

  TEMPERATURE_SENSOR: {
    priority: 65,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.currentTemperature, {
        icon: faThermometerQuarter,
        title: 'Current Temperature',
        value: (e) => `${e.value.toFixed(1)}°C`,
        iconColor: '#ff6f22',
      }),
    ],
  },

  LIGHT_SENSOR: {
    priority: 70,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.illuminance, {
        icon: faLightbulb,
        title: 'Illuminance',
        value: (e) => `${e.value} lx`,
      }),
    ],
  },

  SPEAKER: {
    priority: 80,
    getCapabilityMetrics: () => [
      createCapability(null, {
        icon: faVolumeHigh,
        title: 'Speaker',
        value: 'Connected',
        since: new Date().toISOString(),
        lastReported: new Date().toISOString(),
      }),
    ],
  },

  BUTTON: {
    priority: 85,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.lastPressed, {
        icon: faHandPointer,
        title: 'Last Pressed',
        value: (e) => e
          ? `${humanDate(dayjs(e.start))} at ${dayjs(e.start).format('HH:mm')}`
          : 'Never',
        iconColor: '#04A7F4',
      }),
      createCapability(null, {
        icon: faCalendarDay,
        title: "Today's Presses",
        value: cap.pressesToday.toString(),
        iconColor: '#04A7F4',
        iconHighlighted: cap.pressesToday > 0,
      }),
      createCapability(null, {
        icon: faHashtag,
        title: 'Total Presses',
        value: cap.totalPresses.toString(),
        iconColor: '#04A7F4',
      }),
    ],
  },

  BATTERY_LEVEL_INDICATOR: {
    priority: 90,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.batteryPercentage, {
        icon: (e) => {
          if (e.value === null || e.value <= 25) return faBatteryEmpty;
          if (e.value > 75) return faBatteryFull;
          if (e.value > 50) return faBatteryHalf;
          return faBatteryQuarter;
        },
        title: 'Battery',
        value: (e) => `${e.value}%`,
        iconColor: (e) => {
          if (e.value > 50) return '#2ecc71';
          if (e.value > 25) return '#f39c12';
          return '#e74c3c';
        },
        isIssue: (e) => e.value <= 25,
      }),
    ],
  },

  BATTERY_LOW_INDICATOR: {
    priority: 91,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.isLow, {
        icon: (e) => e.value === false ? faBatteryFull : faBatteryEmpty,
        title: 'Battery',
        value: (e) => e.value ? 'LOW' : 'OK',
        iconColor: (e) => e.value ? '#e74c3c' : '#2ecc71',
        isIssue: (e) => e.value,
      }),
    ],
  },

  ENERGY_MONITOR: {
    priority: 100,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.currentPower, {
        icon: faBolt,
        title: 'Current Power',
        value: (e) => `${Math.round(e.value).toLocaleString()} W`,
        iconColor: '#f1c40f',
        iconHighlighted: (e) => e.value > 0,
      }),
      createCapability(cap.dayEnergy, {
        icon: faPlug,
        title: "Today's Energy",
        value: (e) => `${e.value.toFixed(2)} kWh`,
      }),
      createCapability(cap.dayCost, {
        icon: faSterlingSign,
        title: "Today's Cost",
        value: (e) => `£${(e.value / 100).toFixed(2)}`,
      }),
    ],
    getGraphs: () => [
      { id: 'energy-power', title: 'Power', yMin: 0 },
      {
        id: 'energy-daily',
        title: 'Daily Energy & Cost',
        overridePreset: 'custom',
        overrideStart: dayjs().subtract(1, 'month').startOf('day').toISOString(),
        overrideEnd: dayjs().toISOString(),
        yAxis: {
          yEnergy: { position: 'left', min: 0 },
          yCost: { position: 'right', min: 0 },
        },
      },
    ],
  },

  ENERGY_COST: {
    priority: 101,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.unitRate, {
        icon: faSterlingSign,
        title: 'Unit Rate',
        value: (e) => `${e.value.toFixed(2)}p/kWh`,
      }),
      createCapability(cap.standingCharge, {
        icon: faSterlingSign,
        title: 'Standing Charge',
        value: (e) => `${e.value.toFixed(2)}p/day`,
      }),
    ],
    getGraphs: () => [
      { id: 'energy-unit-rate', title: 'Unit Rate (p/kWh)', yMin: 0 },
    ],
  },

  CONNECTIVITY: {
    priority: 999,
    getCapabilityMetrics: (cap) => [
      createCapability(cap.isConnected, {
        icon: faSignal,
        title: 'Connection',
        value: (e) => e.value ? 'Online' : 'Offline',
        iconColor: (e) => e.value ? '#2ecc71' : '#e74c3c',
        iconHighlighted: (e) => !e.value,
        isIssue: (e) => !e.value,
      }),
    ],
  },
};
