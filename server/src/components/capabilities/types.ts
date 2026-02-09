import { ReactNode } from 'react';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { QueryClient } from '@tanstack/react-query';
import type { CapabilityApiResponse, RestDeviceResponse } from '../../api/types';
import type { DateRangePreset } from '../date-range/types';

// ============================================================================
// Metric Display Context
// ============================================================================

export type MetricDisplayVariant = 'compact' | 'full';

// ============================================================================
// Context for onIconClick
// ============================================================================

export interface IconClickContext {
  openModal: (content: ReactNode) => void;
  closeModal: () => void;
  queryClient: QueryClient;
}

// ============================================================================
// Metric and Graph Types
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

// ============================================================================
// Registry Types
// ============================================================================

/**
 * All valid capability types (excluding null).
 */
export type CapabilityType = Exclude<CapabilityApiResponse['type'], null>;

/**
 * Extract a specific capability type from the CapabilityApiResponse union.
 */
export type ExtractCapability<T extends CapabilityType> =
  CapabilityApiResponse & { type: T };

/**
 * UI configuration for a capability type.
 */
export interface CapabilityUIConfig<T extends CapabilityType> {
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
export type CapabilityUIRegistry = {
  [K in CapabilityType]: CapabilityUIConfig<K>;
};
