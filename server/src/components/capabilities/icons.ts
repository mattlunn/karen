import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faVideo,
  faThermometerQuarter,
  faLightbulb,
  faEye,
  faDroplet,
  faFire,
  faLock,
  faToggleOn,
  faVolumeHigh,
  faBatteryHalf,
  faSun,
  faQuestion,
} from '@fortawesome/free-solid-svg-icons';
import type { CapabilityApiResponse } from '../../api/types';

type CapabilityType = Exclude<CapabilityApiResponse['type'], null>;

/**
 * Icon and priority for each capability type.
 * Lower priority = higher precedence when selecting device icon.
 */
const capabilityIcons: Record<CapabilityType, { icon: IconDefinition; priority: number }> = {
  CAMERA: { icon: faVideo, priority: 10 },
  THERMOSTAT: { icon: faThermometerQuarter, priority: 20 },
  HEAT_PUMP: { icon: faFire, priority: 25 },
  LIGHT: { icon: faLightbulb, priority: 30 },
  LOCK: { icon: faLock, priority: 35 },
  SWITCH: { icon: faToggleOn, priority: 40 },
  MOTION_SENSOR: { icon: faEye, priority: 50 },
  HUMIDITY_SENSOR: { icon: faDroplet, priority: 60 },
  TEMPERATURE_SENSOR: { icon: faThermometerQuarter, priority: 65 },
  LIGHT_SENSOR: { icon: faSun, priority: 70 },
  SPEAKER: { icon: faVolumeHigh, priority: 80 },
  BATTERY_LEVEL_INDICATOR: { icon: faBatteryHalf, priority: 90 },
  BATTERY_LOW_INDICATOR: { icon: faBatteryHalf, priority: 91 },
};

/**
 * Get the most appropriate icon for a device based on its capabilities.
 * Uses priority to determine which capability's icon to show when multiple exist.
 */
export function getDeviceIcon(capabilities: CapabilityApiResponse[]): IconDefinition {
  let bestIcon: IconDefinition = faQuestion;
  let bestPriority = Infinity;

  for (const cap of capabilities) {
    if (cap.type === null) continue;
    const config = capabilityIcons[cap.type];
    if (config.priority < bestPriority) {
      bestPriority = config.priority;
      bestIcon = config.icon;
    }
  }

  return bestIcon;
}

/**
 * Get the icon for a specific capability type.
 */
export function getCapabilityIcon(type: CapabilityType): IconDefinition {
  return capabilityIcons[type].icon;
}
