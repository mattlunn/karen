import { faBatteryHalf } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const batteryLevelIndicatorConfig: CapabilityUIConfig<'BATTERY_LEVEL_INDICATOR'> = {
  type: 'BATTERY_LEVEL_INDICATOR',
  icon: faBatteryHalf,
  iconPriority: 100,

  getStatusItems: (capability) => [
    {
      icon: faBatteryHalf,
      title: 'Battery Level',
      value: `${capability.batteryPercentage.value}%`,
      since: capability.batteryPercentage.start,
      lastReported: capability.batteryPercentage.lastReported,
    },
  ],
};
