import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { CapabilityApiResponse, RestDeviceResponse } from '../../api/types';
import { ReactNode } from 'react';

/**
 * Configuration for a status item displayed on the device detail page.
 */
export interface StatusItemConfig {
  icon: IconDefinition;
  title: string;
  value: string;
  since: string;
  lastReported: string;
  color?: string;
}

/**
 * Configuration for a graph displayed on the device detail page.
 */
export interface GraphConfig {
  id: string;
  title: string;
  yAxis?: Record<string, { position: 'left' | 'right'; min: number; max: number }>;
  yMin?: number;
  yMax?: number;
  zones?: Array<{ min: number; max: number; color: string }>;
}

/**
 * Props for the group control rendering in DeviceControl.
 */
export interface GroupControlProps {
  icon: IconDefinition;
  color: string;
  colorIconBackground: boolean;
  values: ReactNode[];
}

/**
 * Extract a specific capability type from the CapabilityApiResponse union.
 */
export type ExtractCapability<T extends CapabilityApiResponse['type']> =
  Extract<CapabilityApiResponse, { type: T }>;

/**
 * The complete UI configuration for a capability type.
 *
 * This interface defines everything the UI needs to render a capability:
 * - Icon for device listings
 * - Status items for device detail page
 * - Control component for room/group view
 * - Graph configurations for device detail page
 *
 * When adding a new capability, create a file in configs/ that implements
 * this interface. TypeScript will enforce that all required fields are provided.
 */
export interface CapabilityUIConfig<T extends Exclude<CapabilityApiResponse['type'], null>> {
  /**
   * The capability type this config is for.
   */
  type: T;

  /**
   * Icon displayed in device listings.
   */
  icon: IconDefinition;

  /**
   * Priority for icon selection when device has multiple capabilities.
   * Lower number = higher priority.
   * Suggested values: CAMERA=10, THERMOSTAT=20, LIGHT=30, etc.
   */
  iconPriority: number;

  /**
   * Generate status items for the device detail page.
   * Return an array of StatusItemConfig objects.
   */
  getStatusItems: (
    capability: ExtractCapability<T>,
    device: RestDeviceResponse
  ) => StatusItemConfig[];

  /**
   * Custom React component for the group/room control view.
   * If provided, this component will be rendered instead of the default DeviceControl.
   * Use this for interactive controls (e.g., Light with brightness slider, Lock with toggle).
   */
  GroupControl?: React.ComponentType<{
    capability: ExtractCapability<T>;
    device: RestDeviceResponse;
  }>;

  /**
   * Props for the default DeviceControl component in group/room view.
   * Used when GroupControl is not provided.
   * If neither GroupControl nor getGroupControlProps is provided, this capability
   * won't render a specific control in group view.
   */
  getGroupControlProps?: (
    capability: ExtractCapability<T>,
    device: RestDeviceResponse
  ) => GroupControlProps;

  /**
   * Graph configurations for the device detail page.
   * Each graph will be rendered using the DeviceGraph component.
   */
  graphs?: GraphConfig[];

  /**
   * Value to display in the fallback group control when this capability
   * is present but doesn't have its own GroupControl or getGroupControlProps.
   * Used for sensors like TEMPERATURE_SENSOR and LIGHT_SENSOR.
   */
  getGroupFallbackValue?: (capability: ExtractCapability<T>) => string;
}

/**
 * All valid capability types (excluding null).
 */
export type CapabilityType = Exclude<CapabilityApiResponse['type'], null>;

/**
 * The registry type mapping each capability type to its UI config.
 * TypeScript will error if any capability type is missing from the registry.
 */
export type CapabilityUIRegistry = {
  [K in CapabilityType]: CapabilityUIConfig<K>;
};
