import { faEye, faPersonWalking } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const motionSensorConfig: CapabilityUIConfig<'MOTION_SENSOR'> = {
  type: 'MOTION_SENSOR',
  icon: faEye,
  iconPriority: 55,

  getStatusItems: (capability) => [
    {
      icon: faPersonWalking,
      title: 'Status',
      value: 'Motion',
      since: capability.hasMotion.start,
      lastReported: capability.hasMotion.lastReported,
    },
  ],

  getGroupControlProps: (capability) => ({
    icon: faPersonWalking,
    color: '#04A7F4',
    colorIconBackground: capability.hasMotion.value,
    values: [],
  }),
};
