import React, { ReactNode } from 'react';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
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
  faQuestion,
} from '@fortawesome/free-solid-svg-icons';
import type { QueryClient } from '@tanstack/react-query';
import type { CapabilityApiResponse, RestDeviceResponse, DeviceApiResponse, LightUpdateRequest, LockUpdateRequest } from '../../api/types';
import type { DateRangePreset } from '../date-range/types';
import ThermostatModal from '../modals/thermostat-modal';
import dayjs from '../../dayjs';

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
// Context for onIconClick
// ============================================================================

export interface IconClickContext {
  openModal: (content: ReactNode) => void;
  closeModal: () => void;
  queryClient: QueryClient;
}

// ============================================================================
// Types
// ============================================================================

/**
 * A single metric from a capability (e.g., brightness, temperature, power).
 */
export interface CapabilityMetric {
  icon: IconDefinition;
  title: string;
  value: ReactNode;
  since: string;
  lastReported: string;
  iconColor?: string;
  iconHighlighted?: boolean;
  isIssue?: boolean;
  onIconClick?: (ctx: IconClickContext) => void | Promise<void>;
}

/**
 * Configuration for a graph on the device details page.
 */
export interface GraphConfig {
  id: string;
  title: string;
  yAxis?: Record<string, { position: 'left' | 'right'; min?: number; max?: number }>;
  yMin?: number;
  yMax?: number;
  zones?: { min: number; max: number; color: string }[];
  overridePreset?: DateRangePreset;
  overrideStart?: string;
  overrideEnd?: string;
  timeUnit?: string;
}

/**
 * All valid capability types (excluding null).
 */
type CapabilityType = Exclude<CapabilityApiResponse['type'], null>;

/**
 * Extract a specific capability type from the CapabilityApiResponse union.
 */
type ExtractCapability<T extends CapabilityType> =
  CapabilityApiResponse & { type: T };

/**
 * UI configuration for a capability type.
 */
interface CapabilityUIConfig<T extends CapabilityType> {
  priority: number;
  getCapabilityMetrics: (
    capability: ExtractCapability<T>,
    device: RestDeviceResponse
  ) => CapabilityMetric[];
  getGraphs?: () => GraphConfig[];
}

/**
 * Registry type - ensures every capability type has a config.
 */
type CapabilityUIRegistry = {
  [K in CapabilityType]: CapabilityUIConfig<K>;
};

// ============================================================================
// Registry
// ============================================================================

const registry: CapabilityUIRegistry = {
  LIGHT: {
    priority: 30,
    getCapabilityMetrics: (cap, device) => [
      {
        icon: faLightbulb,
        title: 'Status',
        value: cap.isOn.value ? 'On' : 'Off',
        since: cap.isOn.start,
        lastReported: cap.isOn.lastReported,
        iconColor: '#ffa24d',
        iconHighlighted: cap.isOn.value,
        onIconClick: async ({ queryClient }) => {
          const data = await updateLight(device.id, { isOn: !cap.isOn.value });
          updateDeviceCache(queryClient, device.id, data);
        },
      },
      {
        icon: faCircleHalfStroke,
        title: 'Brightness',
        value: `${cap.brightness.value}%`,
        since: cap.brightness.start,
        lastReported: cap.brightness.lastReported,
      },
    ],
    getGraphs: () => [
      { id: 'light', title: 'Activity' },
    ],
  },

  THERMOSTAT: {
    priority: 20,
    getCapabilityMetrics: (cap, device) => [
      {
        icon: faThermometerFull,
        title: 'Current Temperature',
        value: `${cap.currentTemperature.value.toFixed(1)}°C`,
        since: cap.currentTemperature.start,
        lastReported: cap.currentTemperature.lastReported,
        iconColor: '#ff6f22',
        iconHighlighted: cap.isHeating.value,
        onIconClick: ({ openModal, closeModal }) => {
          openModal(
            <ThermostatModal device={device} capability={cap} closeModal={closeModal} />
          );
        },
      },
      {
        icon: faThermometerQuarter,
        title: 'Target Temperature',
        value: `${cap.targetTemperature.value.toFixed(1)}°C`,
        since: cap.targetTemperature.start,
        lastReported: cap.targetTemperature.lastReported,
        iconColor: '#ff6f22',
      },
      {
        icon: faFire,
        title: 'Power',
        value: `${cap.power.value}%`,
        since: cap.power.start,
        lastReported: cap.power.lastReported,
        iconColor: '#ff6f22',
      },
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

  LOCK: {
    priority: 35,
    getCapabilityMetrics: (cap, device) => [
      {
        icon: cap.isLocked.value ? faDoorClosed : faDoorOpen,
        title: 'Lock',
        value: cap.isLocked.value ? 'Locked' : 'Unlocked',
        since: cap.isLocked.start,
        lastReported: cap.isLocked.lastReported,
        iconColor: '#04A7F4',
        iconHighlighted: !cap.isLocked.value,
        onIconClick: async ({ queryClient }) => {
          const data = await updateLock(device.id, { isLocked: !cap.isLocked.value });
          updateDeviceCache(queryClient, device.id, data);
        },
      },
    ],
  },

  CAMERA: {
    priority: 10,
    getCapabilityMetrics: (cap) => [
      {
        icon: faVideo,
        title: 'Camera',
        value: 'Active',
        since: cap.snapshotUrl.start,
        lastReported: cap.snapshotUrl.lastReported,
        iconColor: '#04A7F4',
      },
    ],
  },

  SWITCH: {
    priority: 40,
    getCapabilityMetrics: (cap) => [
      {
        icon: cap.isOn.value ? faToggleOn : faToggleOff,
        title: 'Switch',
        value: cap.isOn.value ? 'On' : 'Off',
        since: cap.isOn.start,
        lastReported: cap.isOn.lastReported,
        iconColor: '#04A7F4',
        iconHighlighted: cap.isOn.value,
      },
    ],
  },

  HEAT_PUMP: {
    priority: 25,
    getCapabilityMetrics: (cap) => [
      {
        icon: faFire,
        title: 'Mode',
        value: `${cap.mode.value[0]}${cap.mode.value.slice(1).toLowerCase()}`,
        since: cap.mode.start,
        lastReported: cap.mode.lastReported,
        iconColor: '#04A7F4',
        iconHighlighted: cap.mode.value !== 'STANDBY',
      },
      {
        icon: faLeaf,
        title: "Today's CoP",
        value: cap.dayCoP.value.toFixed(1),
        since: cap.dayCoP.start,
        lastReported: cap.dayCoP.lastReported,
      },
      {
        icon: faBolt,
        title: "Today's Power",
        value: `${(cap.dayPower.value / 1000).toFixed(1)} kWh`,
        since: cap.dayPower.start,
        lastReported: cap.dayPower.lastReported,
      },
      {
        icon: faFire,
        title: "Today's Yield",
        value: `${(cap.dayYield.value / 1000).toFixed(1)} kWh`,
        since: cap.dayYield.start,
        lastReported: cap.dayYield.lastReported,
      },
      {
        icon: faFaucet,
        title: 'Hot Water CoP',
        value: `${cap.dHWCoP.value.toFixed(1)} CoP`,
        since: cap.dHWCoP.start,
        lastReported: cap.dHWCoP.lastReported,
      },
      {
        icon: faFire,
        title: 'Heating CoP',
        value: `${cap.heatingCoP.value.toFixed(1)} CoP`,
        since: cap.heatingCoP.start,
        lastReported: cap.heatingCoP.lastReported,
      },
      {
        icon: faTree,
        title: 'Outside Temperature',
        value: `${cap.outsideTemperature.value.toFixed(1)}°C`,
        since: cap.outsideTemperature.start,
        lastReported: cap.outsideTemperature.lastReported,
      },
      {
        icon: faFaucetDrip,
        title: 'Hot Water Temperature',
        value: `${cap.dhwTemperature.value.toFixed(1)}°C`,
        since: cap.dhwTemperature.start,
        lastReported: cap.dhwTemperature.lastReported,
      },
      {
        icon: faThermometer4,
        title: 'Flow Temperature',
        value: `${cap.actualFlowTemperature.value.toFixed(1)}°C`,
        since: cap.actualFlowTemperature.start,
        lastReported: cap.actualFlowTemperature.lastReported,
      },
      {
        icon: faThermometer2,
        title: 'Return Temperature',
        value: `${cap.returnTemperature.value.toFixed(1)}°C`,
        since: cap.returnTemperature.start,
        lastReported: cap.returnTemperature.lastReported,
      },
      {
        icon: faGauge,
        title: 'System Pressure',
        value: `${cap.systemPressure.value.toFixed(1)} bar`,
        since: cap.systemPressure.start,
        lastReported: cap.systemPressure.lastReported,
      },
    ],
    getGraphs: () => [
      { id: 'heatpump-power', title: 'Power' },
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

  HUMIDITY_SENSOR: {
    priority: 60,
    getCapabilityMetrics: (cap) => [
      {
        icon: faDroplet,
        title: 'Humidity',
        value: `${cap.humidity.value}%`,
        since: cap.humidity.start,
        lastReported: cap.humidity.lastReported,
        iconColor: '#04A7F4',
      },
    ],
  },

  TEMPERATURE_SENSOR: {
    priority: 65,
    getCapabilityMetrics: (cap) => {
      if (!cap.currentTemperature) return [];
      return [
        {
          icon: faThermometerQuarter,
          title: 'Current Temperature',
          value: `${cap.currentTemperature.value.toFixed(1)}°C`,
          since: cap.currentTemperature.start,
          lastReported: cap.currentTemperature.lastReported,
          iconColor: '#ff6f22',
        },
      ];
    },
  },

  MOTION_SENSOR: {
    priority: 50,
    getCapabilityMetrics: (cap) => [
      {
        icon: faPersonWalking,
        title: 'Motion',
        value: cap.hasMotion.value ? 'Motion detected' : 'No motion',
        since: cap.hasMotion.start,
        lastReported: cap.hasMotion.lastReported,
        iconHighlighted: cap.hasMotion.value,
        iconColor: '#04A7F4',
      },
    ],
  },

  LIGHT_SENSOR: {
    priority: 70,
    getCapabilityMetrics: (cap) => [
      {
        icon: faLightbulb,
        title: 'Illuminance',
        value: `${cap.illuminance.value} lx`,
        since: cap.illuminance.start,
        lastReported: cap.illuminance.lastReported,
      },
    ],
  },

  SPEAKER: {
    priority: 80,
    getCapabilityMetrics: () => [
      {
        icon: faVolumeHigh,
        title: 'Speaker',
        value: 'Connected',
        since: new Date().toISOString(),
        lastReported: new Date().toISOString(),
      },
    ],
  },

  BATTERY_LEVEL_INDICATOR: {
    priority: 90,
    getCapabilityMetrics: (cap) => {
      const percentage = cap.batteryPercentage.value;
      const getBatteryIcon = () => {
        if (percentage > 75) return faBatteryFull;
        if (percentage > 50) return faBatteryHalf;
        if (percentage > 25) return faBatteryQuarter;
        return faBatteryEmpty;
      };
      const getBatteryColor = () => {
        if (percentage > 50) return '#2ecc71';
        if (percentage > 25) return '#f39c12';
        return '#e74c3c';
      };
      return [
        {
          icon: getBatteryIcon(),
          title: 'Battery',
          value: `${percentage}%`,
          since: cap.batteryPercentage.start,
          lastReported: cap.batteryPercentage.lastReported,
          iconColor: getBatteryColor(),
          isIssue: percentage <= 25,
        },
      ];
    },
  },

  BATTERY_LOW_INDICATOR: {
    priority: 91,
    getCapabilityMetrics: (cap) => {
      const isLow = cap.isLow.value;
      return [
        {
          icon: isLow ? faBatteryEmpty : faBatteryFull,
          title: 'Battery',
          value: isLow ? 'LOW' : 'OK',
          since: cap.isLow.start,
          lastReported: cap.isLow.lastReported,
          iconColor: isLow ? '#e74c3c' : '#2ecc71',
          isIssue: isLow,
        },
      ];
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the UI config for a specific capability type.
 */
export function getCapabilityConfig<T extends CapabilityType>(
  type: T
): CapabilityUIConfig<T> {
  return registry[type] as CapabilityUIConfig<T>;
}

/**
 * Get all metrics for a device, sorted by capability priority.
 * First metric's icon is the "device icon".
 */
export function getDeviceMetrics(device: RestDeviceResponse): CapabilityMetric[] {
  const capabilitiesWithMetrics: { priority: number; metrics: CapabilityMetric[] }[] = [];

  for (const capability of device.capabilities) {
    if (capability.type === null) continue;
    const capType = capability.type as CapabilityType;
    const config = registry[capType];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metrics = (config.getCapabilityMetrics as any)(capability, device) as CapabilityMetric[];
    if (metrics.length > 0) {
      capabilitiesWithMetrics.push({ priority: config.priority, metrics });
    }
  }

  // Sort by priority (lower = first)
  capabilitiesWithMetrics.sort((a, b) => a.priority - b.priority);

  // Flatten
  const result: CapabilityMetric[] = [];
  for (const group of capabilitiesWithMetrics) {
    result.push(...group.metrics);
  }
  return result;
}

/**
 * Get the primary icon for a device (first metric's icon).
 */
export function getDeviceIcon(device: RestDeviceResponse): IconDefinition {
  const metrics = getDeviceMetrics(device);
  return metrics[0]?.icon ?? faQuestion;
}

/**
 * Get all graphs for a device.
 */
export function getDeviceGraphs(device: RestDeviceResponse): GraphConfig[] {
  const graphs: GraphConfig[] = [];

  for (const capability of device.capabilities) {
    if (capability.type === null) continue;
    const config = registry[capability.type];
    if (config.getGraphs) {
      graphs.push(...config.getGraphs());
    }
  }

  return graphs;
}

/**
 * Get metrics that are issues (for device list warnings).
 */
export function getDeviceIssues(device: RestDeviceResponse): CapabilityMetric[] {
  return getDeviceMetrics(device).filter((m) => m.isIssue);
}
