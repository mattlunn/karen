import { faVolumeHigh } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const speakerConfig: CapabilityUIConfig<'SPEAKER'> = {
  type: 'SPEAKER',
  icon: faVolumeHigh,
  iconPriority: 80,

  getStatusItems: () => [],
};
