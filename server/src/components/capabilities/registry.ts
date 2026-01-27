import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { CapabilityApiResponse } from '../../api/types';
import {
  CapabilityUIConfig,
  CapabilityUIRegistry,
  CapabilityType,
  GraphConfig,
} from './types';

// Import all capability configs
import { lightConfig } from './configs/light';
import { thermostatConfig } from './configs/thermostat';
import { cameraConfig } from './configs/camera';
import { lockConfig } from './configs/lock';
import { switchConfig } from './configs/switch';
import { humiditySensorConfig } from './configs/humidity-sensor';
import { temperatureSensorConfig } from './configs/temperature-sensor';
import { lightSensorConfig } from './configs/light-sensor';
import { motionSensorConfig } from './configs/motion-sensor';
import { heatPumpConfig } from './configs/heat-pump';
import { speakerConfig } from './configs/speaker';
import { batteryLevelIndicatorConfig } from './configs/battery-level-indicator';
import { batteryLowIndicatorConfig } from './configs/battery-low-indicator';

/**
 * The central registry of all capability UI configurations.
 *
 * TypeScript enforces that every capability type defined in CapabilityApiResponse
 * has a corresponding entry here. If you add a new capability type to the API,
 * you'll get a compile error until you:
 * 1. Create a config file in configs/
 * 2. Add it to this registry
 */
export const capabilityRegistry: CapabilityUIRegistry = {
  LIGHT: lightConfig,
  THERMOSTAT: thermostatConfig,
  CAMERA: cameraConfig,
  LOCK: lockConfig,
  SWITCH: switchConfig,
  HUMIDITY_SENSOR: humiditySensorConfig,
  TEMPERATURE_SENSOR: temperatureSensorConfig,
  LIGHT_SENSOR: lightSensorConfig,
  MOTION_SENSOR: motionSensorConfig,
  HEAT_PUMP: heatPumpConfig,
  SPEAKER: speakerConfig,
  BATTERY_LEVEL_INDICATOR: batteryLevelIndicatorConfig,
  BATTERY_LOW_INDICATOR: batteryLowIndicatorConfig,
};

/**
 * Get the UI configuration for a specific capability type.
 */
export function getCapabilityConfig<T extends CapabilityType>(
  type: T
): CapabilityUIConfig<T> {
  return capabilityRegistry[type] as CapabilityUIConfig<T>;
}

/**
 * Get the icon for a device based on its capabilities.
 * Returns the icon of the highest-priority capability.
 */
export function getDeviceIcon(capabilities: CapabilityApiResponse[]): IconDefinition {
  const validCapabilities = capabilities.filter(
    (c): c is Exclude<CapabilityApiResponse, { type: null }> => c.type !== null
  );

  if (validCapabilities.length === 0) {
    return faQuestion;
  }

  const sorted = validCapabilities
    .map((c) => capabilityRegistry[c.type])
    .sort((a, b) => a.iconPriority - b.iconPriority);

  return sorted[0].icon;
}

/**
 * Get all graphs for a device based on its capabilities.
 */
export function getDeviceGraphs(capabilities: CapabilityApiResponse[]): GraphConfig[] {
  const graphs: GraphConfig[] = [];

  for (const capability of capabilities) {
    if (capability.type === null) continue;
    const config = capabilityRegistry[capability.type];
    if (config.graphs) {
      graphs.push(...config.graphs);
    }
  }

  return graphs;
}

/**
 * Find the first capability that has a custom GroupControl component.
 * Returns the capability and its config, or undefined if none found.
 */
export function findGroupControl(capabilities: CapabilityApiResponse[]): {
  capability: Exclude<CapabilityApiResponse, { type: null }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: CapabilityUIConfig<any>;
} | undefined {
  for (const capability of capabilities) {
    if (capability.type === null) continue;
    const config = capabilityRegistry[capability.type];
    if (config.GroupControl) {
      return { capability, config };
    }
  }
  return undefined;
}

/**
 * Find the first capability that has getGroupControlProps.
 * Returns the capability and its config, or undefined if none found.
 */
export function findGroupControlProps(capabilities: CapabilityApiResponse[]): {
  capability: Exclude<CapabilityApiResponse, { type: null }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: CapabilityUIConfig<any>;
} | undefined {
  for (const capability of capabilities) {
    if (capability.type === null) continue;
    const config = capabilityRegistry[capability.type];
    if (config.getGroupControlProps) {
      return { capability, config };
    }
  }
  return undefined;
}

/**
 * Get fallback values from all capabilities that define getGroupFallbackValue.
 */
export function getGroupFallbackValues(capabilities: CapabilityApiResponse[]): string[] {
  const values: string[] = [];
  for (const capability of capabilities) {
    if (capability.type === null) continue;
    const config = capabilityRegistry[capability.type];
    if (config.getGroupFallbackValue) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values.push(config.getGroupFallbackValue(capability as any));
    }
  }
  return values;
}

// Re-export types for convenience
export type { CapabilityUIConfig, StatusItemConfig, GraphConfig } from './types';
