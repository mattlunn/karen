import { faLightbulb, faCircleHalfStroke } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';
import Light from '../../devices/light';

export const lightConfig: CapabilityUIConfig<'LIGHT'> = {
  type: 'LIGHT',
  icon: faLightbulb,
  iconPriority: 30,

  getStatusItems: (capability) => [
    {
      icon: faLightbulb,
      title: 'Brightness',
      value: `${capability.brightness.value}%`,
      since: capability.brightness.start,
      lastReported: capability.brightness.lastReported,
    },
    {
      icon: faCircleHalfStroke,
      title: 'Status',
      value: 'On',
      since: capability.isOn.start,
      lastReported: capability.isOn.lastReported,
    },
  ],

  GroupControl: Light,

  graphs: [
    { id: 'light', title: 'Activity' },
  ],
};
