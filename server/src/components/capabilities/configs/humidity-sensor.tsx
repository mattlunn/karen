import { faDroplet } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const humiditySensorConfig: CapabilityUIConfig<'HUMIDITY_SENSOR'> = {
  type: 'HUMIDITY_SENSOR',
  icon: faDroplet,
  iconPriority: 60,

  getStatusItems: (capability) => [
    {
      icon: faDroplet,
      title: 'Humidity',
      value: `${capability.humidity.value}%`,
      since: capability.humidity.start,
      lastReported: capability.humidity.lastReported,
      color: '#04A7F4',
    },
  ],

  getGroupControlProps: (capability, device) => {
    const tempSensor = device.capabilities.find(x => x.type === 'TEMPERATURE_SENSOR');
    const tempValue = tempSensor?.type === 'TEMPERATURE_SENSOR'
      ? `${tempSensor.currentTemperature.value.toFixed(1)}°`
      : '?°';

    return {
      icon: faDroplet,
      color: '#04A7F4',
      colorIconBackground: false,
      values: [
        `${capability.humidity.value}%`,
        tempValue,
      ],
    };
  },
};
