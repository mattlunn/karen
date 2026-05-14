import { ReactNode } from 'react';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { QueryClient } from '@tanstack/react-query';
import type {
  CapabilityApiResponse,
  RestDeviceResponse,
  NumericEventApiResponse,
  BooleanEventApiResponse,
  EnumEventApiResponse,
} from '../../api/types';
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
 * Either provide `since` + `lastReported` for auto-formatted timestamps,
 * or provide `footer` for a custom string (or omit for no footer).
 */
type CapabilityMetricBase = {
  icon: IconDefinition;
  title: string;
  value: ReactNode;
  iconColor?: string;
  iconHighlighted?: boolean;
  isIssue?: boolean;
  onIconClick?: (ctx: IconClickContext) => void | Promise<void>;
};

export type CapabilityMetric = CapabilityMetricBase & (
  | { since: string; lastReported: string }
  | { footer?: string }
);

/**
 * An event-shaped capability value (anything carrying `start` / `lastReported`).
 */
export type CapabilityEvent = NumericEventApiResponse | BooleanEventApiResponse | EnumEventApiResponse;

/**
 * A config value that is either static, or a function resolved against the
 * metric's backing event (which may be `null` when there is no event).
 */
export type EventResolved<E extends CapabilityEvent | null, T> = T | ((event: E) => T);

/**
 * Config for `createCapability`. Any of the display props may be a plain value
 * or a function of the backing event. `since` / `lastReported` are derived from
 * the event automatically unless given explicitly (or `footer` is used instead,
 * for metrics with no backing event).
 */
export type CreateCapabilityConfig<E extends CapabilityEvent | null> = {
  icon: EventResolved<E, IconDefinition>;
  title: string;
  value: EventResolved<E, ReactNode>;
  iconColor?: EventResolved<E, string | undefined>;
  iconHighlighted?: EventResolved<E, boolean | undefined>;
  isIssue?: EventResolved<E, boolean | undefined>;
  onIconClick?: (ctx: IconClickContext) => void | Promise<void>;
  since?: string;
  lastReported?: string;
  footer?: string;
};

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
