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
