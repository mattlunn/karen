import { faToggleOff } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const switchConfig: CapabilityUIConfig<'SWITCH'> = {
  type: 'SWITCH',
  icon: faToggleOff,
  iconPriority: 40,

  getStatusItems: () => [],

  getGroupControlProps: (capability) => ({
    icon: faToggleOff,
    color: '#04A7F4',
    colorIconBackground: capability.isOn.value,
    values: [],
  }),
};
