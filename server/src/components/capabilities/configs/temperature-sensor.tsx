import { faThermometerQuarter } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const temperatureSensorConfig: CapabilityUIConfig<'TEMPERATURE_SENSOR'> = {
  type: 'TEMPERATURE_SENSOR',
  icon: faThermometerQuarter,
  iconPriority: 50,

  getStatusItems: (capability) => {
    if (!capability.currentTemperature) return [];

    return [
      {
        icon: faThermometerQuarter,
        title: 'Current Temperature',
        value: `${capability.currentTemperature.value.toFixed(1)}°C`,
        since: capability.currentTemperature.start,
        lastReported: capability.currentTemperature.lastReported,
        color: '#ff6f22',
      },
    ];
  },

  getGroupFallbackValue: (capability) =>
    `${capability.currentTemperature.value.toFixed(1)}°`,
};
