import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import type { RestDeviceResponse } from '../../api/types';
import type { CapabilityType, CapabilityUIConfig, CapabilityMetric, GraphConfig } from './types';
import { registry } from './registry';

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

// Icon colour is a state signal, not decoration. See `getMetricIconColor`.
const ICON_COLOR_NEUTRAL = 'light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-3))';
const ICON_COLOR_ISSUE = 'var(--mantine-color-red-6)';
const ICON_COLOR_ACTIVE_FALLBACK = 'var(--mantine-primary-color-filled)';

// Darker neutral used for the clickable filled-button background, so a white
// glyph on top stays legible.
const ICON_BG_NEUTRAL = 'light-dark(var(--mantine-color-gray-6), var(--mantine-color-dark-4))';

type MetricColorInputs = { iconColor?: string; iconHighlighted?: boolean; isIssue?: boolean };

function resolveSemanticColor(metric: MetricColorInputs | undefined, neutral: string): string {
  if (!metric) {
    return neutral;
  }

  if (metric.isIssue) {
    return ICON_COLOR_ISSUE;
  }

  if (metric.iconHighlighted === undefined) {
    return metric.iconColor ?? neutral;
  }

  if (metric.iconHighlighted) {
    return metric.iconColor ?? ICON_COLOR_ACTIVE_FALLBACK;
  }

  return neutral;
}

/**
 * Resolves the colour a metric's icon should render in when shown as a bare
 * glyph (non-clickable). Colour is reserved for meaning, never decoration:
 *
 * - `isIssue` wins outright and renders red.
 * - `iconHighlighted` defined means the metric has an active/inactive concept:
 *   `iconColor` (the "active" colour) shows only while highlighted, otherwise
 *   the icon is neutral grey.
 * - `iconHighlighted` undefined means there is no active/inactive concept; an
 *   `iconColor` here is treated as intrinsic and always shown (rare — e.g. a
 *   bin's collection colour). Most such metrics leave `iconColor` unset and
 *   stay neutral grey.
 */
export function getMetricIconColor(metric?: MetricColorInputs): string {
  return resolveSemanticColor(metric, ICON_COLOR_NEUTRAL);
}

/**
 * Resolves the filled background colour for a clickable metric icon. Same
 * semantics as `getMetricIconColor`, but uses a darker neutral so the white
 * glyph placed on top stays legible.
 */
export function getMetricButtonBackgroundColor(metric?: MetricColorInputs): string {
  return resolveSemanticColor(metric, ICON_BG_NEUTRAL);
}

export function getIsConnected(device: RestDeviceResponse): boolean | null {
  const conn = device.capabilities.find(c => c.type === 'CONNECTIVITY');
  return conn ? conn.isConnected.value : null;
}
