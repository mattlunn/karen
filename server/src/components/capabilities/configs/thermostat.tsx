import { faThermometerQuarter, faFire, faThermometerFull } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const thermostatConfig: CapabilityUIConfig<'THERMOSTAT'> = {
  type: 'THERMOSTAT',
  icon: faThermometerQuarter,
  iconPriority: 20,

  getStatusItems: (capability) => [
    {
      icon: faThermometerQuarter,
      title: 'Target Temperature',
      value: `${capability.targetTemperature.value.toFixed(1)}°C`,
      since: capability.targetTemperature.start,
      lastReported: capability.targetTemperature.lastReported,
      color: '#ff6f22',
    },
    {
      icon: faFire,
      title: 'Power',
      value: `${capability.power.value}%`,
      since: capability.power.start,
      lastReported: capability.power.lastReported,
      color: '#ff6f22',
    },
  ],

  getGroupControlProps: (capability) => ({
    icon: faThermometerFull,
    color: '#ff6f22',
    colorIconBackground: capability.isHeating.value,
    values: [
      `${capability.currentTemperature.value.toFixed(1)}°`,
      `${capability.targetTemperature.value.toFixed(1)}°`,
      `${capability.power.value}%`,
    ],
  }),

  graphs: [
    {
      id: 'thermostat',
      title: 'Temperature & Power',
      yAxis: {
        yTemperature: { position: 'left', min: 0, max: 30 },
        yPercentage: { position: 'right', min: 0, max: 100 },
      },
    },
  ],
};
