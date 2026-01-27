import { faVideo } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const cameraConfig: CapabilityUIConfig<'CAMERA'> = {
  type: 'CAMERA',
  icon: faVideo,
  iconPriority: 10,

  getStatusItems: () => [],

  getGroupControlProps: () => ({
    icon: faVideo,
    color: '#04A7F4',
    colorIconBackground: false,
    values: [],
  }),
};
