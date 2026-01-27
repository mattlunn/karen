import { faLightbulb } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const lightSensorConfig: CapabilityUIConfig<'LIGHT_SENSOR'> = {
  type: 'LIGHT_SENSOR',
  icon: faLightbulb,
  iconPriority: 70,

  getStatusItems: (capability) => [
    {
      icon: faLightbulb,
      title: 'Illuminance',
      value: `${capability.illuminance.value} lx`,
      since: capability.illuminance.start,
      lastReported: capability.illuminance.lastReported,
    },
  ],

  getGroupFallbackValue: (capability) =>
    `${capability.illuminance.value}lx`,
};
