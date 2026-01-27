import { faBatteryEmpty } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const batteryLowIndicatorConfig: CapabilityUIConfig<'BATTERY_LOW_INDICATOR'> = {
  type: 'BATTERY_LOW_INDICATOR',
  icon: faBatteryEmpty,
  iconPriority: 100,

  getStatusItems: (capability) => [
    {
      icon: faBatteryEmpty,
      title: 'Battery Status',
      value: capability.isLow.value ? 'Low' : 'OK',
      since: capability.isLow.start,
      lastReported: capability.isLow.lastReported,
      color: capability.isLow.value ? '#ff0000' : undefined,
    },
  ],
};
